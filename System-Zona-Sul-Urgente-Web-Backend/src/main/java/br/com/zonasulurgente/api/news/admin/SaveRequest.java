package br.com.zonasulurgente.api.news.admin;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/** O que o botão pediu: rascunho, revisão, publicar ou agendar — mais a notícia. */
public record SaveRequest(@NotNull(message = "Envie a notícia.") NewsDraft draft,
		@Pattern(regexp = "draft|review|publish|schedule", message = "Ação inválida.") String intent) {
}
