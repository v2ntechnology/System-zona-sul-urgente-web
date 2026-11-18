package br.com.zonasulurgente.api.usage;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.HttpStatus;

import br.com.zonasulurgente.api.shared.web.ApiException;

/**
 * Recurso travado que não volta sozinho em minutos (espaço das fotos, gravações do mês): recusa com 507 e mensagem
 * para a pessoa (FR-006). {@code retryAt} = próxima conferência (quando a trava pode desligar), para quem quiser
 * tentar de novo depois (ex.: a foto de um post do Instagram).
 */
public class QuotaBlockedException extends ApiException {

	private final String resource;
	private final transient Instant retryAt;

	public QuotaBlockedException(String resource, Instant retryAt, String detail) {
		super(HttpStatus.INSUFFICIENT_STORAGE, "Espaço de fotos esgotado", detail);
		this.resource = resource;
		this.retryAt = retryAt;
	}

	public String resource() {
		return resource;
	}

	public Instant retryAt() {
		return retryAt;
	}

	@Override
	public Map<String, Object> properties() {
		return Map.of("resource", resource);
	}

}
