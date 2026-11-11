package br.com.zonasulurgente.api.audit;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;

/** Registro de auditoria como o painel lê. Opcionais ausentes, nunca null. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuditEntry(UUID id, OffsetDateTime occurredAt, Actor actor, String origin, String action,
		String entityType, String entityId, String entityLabel, @JsonRawValue String diff,
		@JsonRawValue String details, String ip, String requestId) {

	/** Quem fez; {@code id} ausente = sem conta identificada. Sem ator = sistema. */
	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record Actor(UUID id, String name) {
	}

}
