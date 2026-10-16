package br.com.zonasulurgente.api.shared.web;

/** Recurso inexistente (ou não visível para quem pediu): vira 404 em problem+json. */
public class NotFoundException extends RuntimeException {

	public NotFoundException(String message) {
		super(message);
	}

}
