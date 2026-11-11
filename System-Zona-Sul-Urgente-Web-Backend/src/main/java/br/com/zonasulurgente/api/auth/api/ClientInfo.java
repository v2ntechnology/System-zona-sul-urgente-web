package br.com.zonasulurgente.api.auth.api;

import br.com.zonasulurgente.api.shared.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;

/** IP (ver {@link ClientIp}) e navegador de quem está entrando no painel. */
final class ClientInfo {

	private ClientInfo() {
	}

	static String ip(HttpServletRequest request) {
		return ClientIp.of(request);
	}

	static String userAgent(HttpServletRequest request) {
		return request.getHeader("X-Client-User-Agent") != null ? request.getHeader("X-Client-User-Agent")
				: request.getHeader("User-Agent");
	}

}
