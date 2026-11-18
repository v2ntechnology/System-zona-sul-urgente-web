package br.com.zonasulurgente.api.jobs;

import java.time.Instant;

/**
 * Lançada por um {@link JobHandler} que precisa esperar (ex.: cota de um plano grátis esgotada, spec 004): o job
 * volta para a fila em {@link #retryAt()} sem gastar tentativa e sem ser contado como erro. A fila não sabe o motivo
 * da espera — quem conhece cotas estende esta exceção.
 */
public class JobDeferredException extends RuntimeException {

	private final transient Instant retryAt;
	private final String reason;

	public JobDeferredException(Instant retryAt, String reason) {
		super(reason);
		this.retryAt = retryAt;
		this.reason = reason;
	}

	public Instant retryAt() {
		return retryAt;
	}

	public String reason() {
		return reason;
	}

}
