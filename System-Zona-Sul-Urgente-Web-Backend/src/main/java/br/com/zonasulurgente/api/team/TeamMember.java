package br.com.zonasulurgente.api.team;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Pessoa da equipe no painel (FE-159), no formato do TeamMember do frontend. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TeamMember(UUID id, String name, String email, String role, String status, boolean twoFactor,
		OffsetDateTime lastLoginAt, OffsetDateTime invitedAt, String authorSlug) {
}
