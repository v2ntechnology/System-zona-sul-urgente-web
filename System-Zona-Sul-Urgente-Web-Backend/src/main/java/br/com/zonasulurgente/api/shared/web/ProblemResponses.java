package br.com.zonasulurgente.api.shared.web;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.slf4j.MDC;
import org.springframework.http.MediaType;

import jakarta.servlet.http.HttpServletResponse;

/**
 * Escreve problem+json fora do Spring MVC (filtros de segurança). Os textos são fixos e o
 * requestId só tem caracteres seguros (RequestIdFilter), então não precisa de serializador.
 */
public final class ProblemResponses {

	private ProblemResponses() {
	}

	public static void write(HttpServletResponse response, int status, String title, String detail)
			throws IOException {
		String requestId = MDC.get(RequestIdFilter.MDC_KEY);
		String json = "{\"type\":\"about:blank\",\"title\":\"" + title + "\",\"status\":" + status
				+ ",\"detail\":\"" + detail + "\""
				+ (requestId != null ? ",\"requestId\":\"" + requestId + "\"" : "") + "}";
		response.setStatus(status);
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		response.getWriter().write(json);
	}

}
