package br.com.zonasulurgente.api.team;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Quem assina matérias (FE-159), com ou sem login; formato do AuthorProfile do frontend. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthorProfile(UUID id, String slug, String name, String role, String bio, String photoUrl,
		String instagram, boolean active, long newsCount, Member member) {

	public record Member(UUID id, String name) {
	}

	/** O que a tela envia ao criar/editar. */
	public record Input(String name, String role, String bio, String instagram) {
	}

}
