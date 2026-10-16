package br.com.zonasulurgente.api.auth.application;

import java.util.List;
import java.util.UUID;

/** Quem está logado (principal do Spring Security nas rotas /api/v1/admin/**). */
public record AuthenticatedUser(UUID id, String name, String email, String role, List<String> permissions,
		String authorSlug, UUID sessionId) {
}
