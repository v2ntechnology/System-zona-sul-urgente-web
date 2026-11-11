package br.com.zonasulurgente.api.audit;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Um registro de auditoria a gravar. {@code diff}: campos alterados (monte com {@link AuditDiff});
 * {@code details}: contexto que não é campo da entidade (modelo da IA, motivo da falha...).
 * Nunca coloque senha, token, segredo ou chave em nenhum dos dois.
 */
public record AuditEvent(AuditAction action, String entityType, String entityId, String entityLabel,
		Map<String, Object> diff, Map<String, Object> details) {

	public AuditEvent {
		diff = diff == null ? Map.of() : diff;
		details = details == null ? Map.of() : details;
	}

	public static AuditEvent of(AuditAction action, String entityType, Object entityId, String entityLabel) {
		return new AuditEvent(action, entityType, entityId == null ? null : entityId.toString(), entityLabel, null,
				null);
	}

	public AuditEvent withDiff(Map<String, Object> diff) {
		return new AuditEvent(action, entityType, entityId, entityLabel, diff, details);
	}

	/** Acrescenta uma informação de contexto (valor nulo é ignorado). */
	public AuditEvent detail(String key, Object value) {
		if (value == null) {
			return this;
		}
		Map<String, Object> next = new LinkedHashMap<>(details);
		next.put(key, AuditDiff.summarize(key, value));
		return new AuditEvent(action, entityType, entityId, entityLabel, diff, next);
	}

}
