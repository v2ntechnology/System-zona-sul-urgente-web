package br.com.zonasulurgente.api.ai;

import org.springframework.http.HttpStatus;

import br.com.zonasulurgente.api.shared.web.ApiException;

/** A IA não respondeu (rede, tempo esgotado, limite de uso, erro do fornecedor). Vale tentar de novo depois. */
public class AiUnavailableException extends ApiException {

	public AiUnavailableException(String detail) {
		super(HttpStatus.SERVICE_UNAVAILABLE, "IA indisponível", detail);
	}

}
