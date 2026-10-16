package br.com.zonasulurgente.api.shared.contract;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Columnist(String authorSlug, String name, String bio) {
}
