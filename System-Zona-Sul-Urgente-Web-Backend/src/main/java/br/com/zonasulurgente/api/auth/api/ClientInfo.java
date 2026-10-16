package br.com.zonasulurgente.api.auth.api;

import java.util.regex.Pattern;

import jakarta.servlet.http.HttpServletRequest;

/**
 * IP real de quem está no navegador. A API só recebe tráfego do Next (rede interna), que
 * repassa o IP original em X-Client-IP (vindo do CF-Connecting-IP); por isso confia nele.
 */
final class ClientInfo {

	private static final Pattern IP = Pattern.compile("[0-9a-fA-F:.]{2,45}");

	private ClientInfo() {
	}

	static String ip(HttpServletRequest request) {
		String forwarded = request.getHeader("X-Client-IP");
		return forwarded != null && IP.matcher(forwarded).matches() ? forwarded : request.getRemoteAddr();
	}

	static String userAgent(HttpServletRequest request) {
		return request.getHeader("X-Client-User-Agent") != null ? request.getHeader("X-Client-User-Agent")
				: request.getHeader("User-Agent");
	}

}
