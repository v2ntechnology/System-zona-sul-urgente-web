package br.com.zonasulurgente.api.ai;

import org.springframework.http.HttpStatus;

import br.com.zonasulurgente.api.shared.web.ApiException;

/** A IA respondeu, mas fora das regras (ex.: "campo titulo vazio"). Mesmo texto da fila do Instagram no painel. */
public class AiOutputException extends ApiException {

	public AiOutputException(String reason) {
		super(HttpStatus.BAD_GATEWAY, "A IA não retornou um texto válido",
				"A IA não retornou um texto válido (" + reason + "). Reprocesse ou crie a notícia manualmente.");
	}

}
