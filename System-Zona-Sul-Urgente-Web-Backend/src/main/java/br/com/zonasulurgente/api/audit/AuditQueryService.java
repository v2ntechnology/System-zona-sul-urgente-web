package br.com.zonasulurgente.api.audit;

import java.util.HashMap;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.shared.contract.Page;
import br.com.zonasulurgente.api.shared.web.Cursor;

/** Leitura da auditoria para o painel: mais recentes primeiro, keyset por (data, id). */
@Service
public class AuditQueryService {

	public record Filter(String entityType, String entityId, UUID actorId, String action, String cursor, int limit) {
	}

	private final JdbcClient jdbc;

	AuditQueryService(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	@Transactional(readOnly = true)
	public Page<AuditEntry> list(Filter f) {
		var where = new StringBuilder("WHERE true");
		var params = new HashMap<String, Object>();
		if (f.entityType() != null) {
			where.append(" AND entity_type = :entityType");
			params.put("entityType", f.entityType());
		}
		if (f.entityId() != null) {
			where.append(" AND entity_id = :entityId");
			params.put("entityId", f.entityId());
		}
		if (f.actorId() != null) {
			where.append(" AND actor_id = :actorId");
			params.put("actorId", f.actorId());
		}
		if (f.action() != null) {
			where.append(" AND action = :action");
			params.put("action", f.action());
		}
		if (f.cursor() != null) {
			Cursor.Keyset after = Cursor.parseKeyset(f.cursor());
			where.append(" AND (occurred_at, id) < (:afterAt, :afterId)");
			params.put("afterAt", after.publishedAt());
			params.put("afterId", after.id());
		}
		params.put("limit", f.limit() + 1);
		List<AuditEntry> rows = jdbc.sql("""
				SELECT id, occurred_at, actor_id, actor_name, origin, action, entity_type, entity_id, entity_label,
				       diff::text AS diff, details::text AS details, ip, request_id
				FROM audit_logs
				""" + where + " ORDER BY occurred_at DESC, id DESC LIMIT :limit")
			.params(params)
			.query((rs, i) -> {
				UUID actorId = rs.getObject("actor_id", UUID.class);
				String actorName = rs.getString("actor_name");
				return new AuditEntry(rs.getObject("id", UUID.class),
						rs.getObject("occurred_at", java.time.OffsetDateTime.class),
						actorId == null && actorName == null ? null : new AuditEntry.Actor(actorId, actorName),
						rs.getString("origin"), rs.getString("action"), rs.getString("entity_type"),
						rs.getString("entity_id"), rs.getString("entity_label"), rs.getString("diff"),
						rs.getString("details"), rs.getString("ip"), rs.getString("request_id"));
			})
			.list();
		String next = null;
		if (rows.size() > f.limit()) {
			rows = rows.subList(0, f.limit());
			AuditEntry last = rows.getLast();
			next = Cursor.keyset(last.occurredAt(), last.id());
		}
		return new Page<>(rows, next, null);
	}

}
