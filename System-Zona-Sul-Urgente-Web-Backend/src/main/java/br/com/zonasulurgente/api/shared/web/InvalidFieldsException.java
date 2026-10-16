package br.com.zonasulurgente.api.shared.web;

import java.util.Map;

/**
 * Campos de um formulário do painel inválidos: 400 com {@code errors: [{field, message}]},
 * usando os mesmos nomes de campo da tela (a tela mostra cada erro no seu campo).
 */
public class InvalidFieldsException extends RuntimeException {

	private final Map<String, String> errors;

	public InvalidFieldsException(Map<String, String> errors) {
		super("Revise os campos indicados.");
		this.errors = Map.copyOf(errors);
	}

	public Map<String, String> errors() {
		return errors;
	}

}
