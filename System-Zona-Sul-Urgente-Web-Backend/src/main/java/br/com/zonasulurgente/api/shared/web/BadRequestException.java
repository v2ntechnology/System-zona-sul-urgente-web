package br.com.zonasulurgente.api.shared.web;

/** Parâmetro inválido que não passa pelo Bean Validation (ex.: cursor adulterado). */
public class BadRequestException extends RuntimeException {

	public BadRequestException(String message) {
		super(message);
	}

}
