package br.com.zonasulurgente.api.taxonomy.admin;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Editoria no painel (FE-158): inclui desativadas e o número de matérias (com as das filhas). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdminCategory(UUID id, String name, String slug, String parentSlug, String color, boolean inBar,
		boolean active, int order, String whatsappUrl, String description, long newsCount) {

	/** O que a tela envia ao criar/editar (mesmos campos do CategoryDraft do frontend). */
	public record Input(String name, String slug, String parentSlug, String color, boolean inBar, String whatsappUrl,
			String description) {
	}

}
