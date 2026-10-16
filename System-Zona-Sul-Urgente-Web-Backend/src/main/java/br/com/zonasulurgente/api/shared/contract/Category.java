package br.com.zonasulurgente.api.shared.contract;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Editoria. URL na raiz: /{slug} ou /{mae}/{slug}. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Category(UUID id, String slug, String name, String description, CategoryRef parent,
		String whatsappUrl, Columnist columnist, Integer order, Boolean inBar, Boolean active,
		String color) {
}
