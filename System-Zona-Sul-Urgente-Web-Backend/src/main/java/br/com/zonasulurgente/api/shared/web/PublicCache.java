package br.com.zonasulurgente.api.shared.web;

import java.time.Duration;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

/**
 * Cabeçalhos de cache da API pública para a CDN (BE-004): curto no navegador, um pouco mais
 * na borda, e servindo a versão antiga enquanto revalida. A publicação invalida pelo Next/CDN
 * (BE-011), então o TTL é só uma rede de segurança.
 */
public final class PublicCache {

	private PublicCache() {
	}

	public static <T> ResponseEntity<T> ok(T body) {
		return ResponseEntity.ok()
			.cacheControl(CacheControl.maxAge(Duration.ofSeconds(30))
				.sMaxAge(Duration.ofSeconds(60))
				.staleWhileRevalidate(Duration.ofMinutes(5))
				.cachePublic())
			.body(body);
	}

}
