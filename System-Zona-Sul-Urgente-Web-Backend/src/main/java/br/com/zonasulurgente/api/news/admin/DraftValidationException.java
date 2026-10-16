package br.com.zonasulurgente.api.news.admin;

import java.util.Map;

/** Campos inválidos do editor; as chaves batem com DraftErrors do frontend ("image.alt"...). */
public class DraftValidationException extends RuntimeException {

	private final Map<String, String> errors;

	public DraftValidationException(Map<String, String> errors) {
		super("Revise os campos destacados.");
		this.errors = errors;
	}

	public Map<String, String> errors() {
		return errors;
	}

}
