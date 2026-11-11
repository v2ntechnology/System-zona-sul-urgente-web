package br.com.zonasulurgente.api.shared.web;

import java.util.regex.Pattern;

import jakarta.servlet.http.HttpServletRequest;

/**
 * IP real de quem está no navegador. A API só recebe tráfego do Next (rede interna), que
 * repassa o IP original em X-Client-IP (vindo do CF-Connecting-IP); por isso confia nele.
 */
public final class ClientIp {

	private static final Pattern IP = Pattern.compile("[0-9a-fA-F:.]{2,45}");

	private ClientIp() {
	}

	public static String of(HttpServletRequest request) {
		String forwarded = request.getHeader("X-Client-IP");
		return forwarded != null && IP.matcher(forwarded).matches() ? forwarded : request.getRemoteAddr();
	}

}
