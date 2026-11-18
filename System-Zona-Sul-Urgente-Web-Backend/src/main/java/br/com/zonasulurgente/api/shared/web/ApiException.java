package br.com.zonasulurgente.api.shared.web;

import org.springframework.http.HttpStatus;

/** Erro de negócio com status e título próprios (vira problem+json em português). */
public class ApiException extends RuntimeException {

	private final HttpStatus status;
	private final String title;

	public ApiException(HttpStatus status, String title, String detail) {
		super(detail);
		this.status = status;
		this.title = title;
	}

	public HttpStatus status() {
		return status;
	}

	public String title() {
		return title;
	}

	/** Campos extras do problem+json (ex.: {@code retryAt}). Vazio por padrão. */
	public java.util.Map<String, Object> properties() {
		return java.util.Map.of();
	}

}
