package br.com.zonasulurgente.api.usage;

import java.time.Instant;

import br.com.zonasulurgente.api.jobs.JobDeferredException;

/**
 * Cota de uma janela curta esgotada (ex.: pedidos à IA no minuto ou no dia): o trabalho espera até
 * {@link #retryAt()}. Dentro de um job, a fila adia sem gastar tentativa (FR-008); numa requisição, quem chamou
 * responde 429 com a hora prevista.
 */
public class QuotaDeferredException extends JobDeferredException {

	private final String resource;

	public QuotaDeferredException(String resource, Instant retryAt, String reason) {
		super(retryAt, reason);
		this.resource = resource;
	}

	public String resource() {
		return resource;
	}

}
