package br.com.zonasulurgente.api.shared.contract;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Author(UUID id, String slug, String name, String role, String bio, Boolean active,
		String instagram) {
}
