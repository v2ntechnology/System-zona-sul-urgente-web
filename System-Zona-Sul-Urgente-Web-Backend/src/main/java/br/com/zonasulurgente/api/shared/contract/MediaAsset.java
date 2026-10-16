package br.com.zonasulurgente.api.shared.contract;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MediaAsset(UUID id, String url, int width, int height, String alt, String caption,
		String credit) {
}
