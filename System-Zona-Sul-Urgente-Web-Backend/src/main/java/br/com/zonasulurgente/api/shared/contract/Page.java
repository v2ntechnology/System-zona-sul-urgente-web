package br.com.zonasulurgente.api.shared.contract;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Paginação por cursor opaco; {@code nextCursor} nulo = acabou (sempre presente no JSON). */
public record Page<T>(List<T> items, String nextCursor,
		@JsonInclude(JsonInclude.Include.NON_NULL) Long total) {
}
