package br.com.zonasulurgente.api.audit;

import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.shared.web.ClientIp;
import br.com.zonasulurgente.api.shared.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import tools.jackson.databind.json.JsonMapper;

/**
 * Grava a auditoria (BE-008) na transação da própria ação: chame de dentro do método
 * {@code @Transactional} que faz a mudança, depois dela. Se a ação for desfeita, o registro também é
 * (MANDATORY: sem transação aberta é erro de programação, não registro solto). Quem fez vem do login
 * da requisição (ou do {@link Actor} passado); IP e requestId, da requisição. Sem requisição
 * (agendamento, job) ou {@link #recordSystem} = origem SYSTEM, sem IP.
 */
@Service
public class AuditLog {

	/** Quem fez a ação. {@code id} nulo = ainda sem conta identificada (ex.: e-mail inexistente no login). */
	public record Actor(UUID id, String name) {

		public static Actor of(AuthenticatedUser user) {
			return user == null ? null : new Actor(user.id(), user.name());
		}

	}

	private final JdbcClient jdbc;
	private final JsonMapper json;

	AuditLog(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	/** Registra em nome de quem está logado nesta requisição (ou do sistema, fora de requisição). */
	@Transactional(propagation = Propagation.MANDATORY)
	public void record(AuditEvent event) {
		record(event, currentActor());
	}

	@Transactional(propagation = Propagation.MANDATORY)
	public void record(AuditEvent event, Actor actor) {
		write(event, actor, RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs
				? attrs.getRequest()
				: null);
	}

	/** Ação do próprio sistema (agendamento, job): sem pessoa, sem IP, mesmo se houver requisição em volta. */
	@Transactional(propagation = Propagation.MANDATORY)
	public void recordSystem(AuditEvent event) {
		write(event, null, null);
	}

	private void write(AuditEvent event, Actor actor, HttpServletRequest request) {
		jdbc.sql("""
				INSERT INTO audit_logs (actor_id, actor_name, origin, action, entity_type, entity_id, entity_label,
				  diff, details, ip, request_id)
				VALUES (:actorId, :actorName, :origin, :action, :entityType, :entityId, :entityLabel,
				  :diff::jsonb, :details::jsonb, :ip, :requestId)""")
			.param("actorId", actor == null ? null : actor.id())
			.param("actorName", actor == null ? null : cut(actor.name(), 120))
			.param("origin", request == null ? "SYSTEM" : "PANEL")
			.param("action", event.action().name())
			.param("entityType", event.entityType())
			.param("entityId", cut(event.entityId(), 64))
			.param("entityLabel", cut(event.entityLabel(), 200))
			.param("diff", json.writeValueAsString(event.diff()))
			.param("details", json.writeValueAsString(event.details()))
			.param("ip", request == null ? null : cut(ClientIp.of(request), 64))
			.param("requestId", request == null ? null : MDC.get(RequestIdFilter.MDC_KEY))
			.update();
	}

	private static Actor currentActor() {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		return auth != null && auth.getPrincipal() instanceof AuthenticatedUser user ? Actor.of(user) : null;
	}

	private static String cut(String value, int max) {
		return value == null || value.length() <= max ? value : value.substring(0, max);
	}

}
