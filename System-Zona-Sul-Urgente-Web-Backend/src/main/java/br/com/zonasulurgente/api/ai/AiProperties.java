package br.com.zonasulurgente.api.ai;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * IA editorial (BE-014, ARCHITECTURE §6). {@code provider}: "gemini" (validação com o cliente, plano grátis) ou
 * "fake" (determinístico, sem rede: testes e desenvolvimento sem chave). No plano grátis o fornecedor pode usar o
 * que recebe para melhorar os produtos: só conteúdo público vai para a IA.
 */
@ConfigurationProperties("zsu.ai")
public record AiProperties(
		@DefaultValue("fake") String provider,
		@DefaultValue Gemini gemini) {

	/**
	 * API Interactions do Gemini ({@code POST /v1beta/interactions}). A geração 2.5 está sendo desativada
	 * (dez/2026): usar a família 3.x. Em 2026-11-10, no plano grátis, o 3.8-flash não respondia (travava) e o
	 * 3.6/3.5-flash davam 503; o 3.7-flash respondeu em ~7 s com o melhor texto. {@code apiRevision} fixa o
	 * formato da API.
	 */
	public record Gemini(
			@DefaultValue("") String apiKey,
			@DefaultValue("gemini-3.7-flash") String model,
			@DefaultValue("https://generativelanguage.googleapis.com") String baseUrl,
			@DefaultValue("2026-05-20") String apiRevision,
			@DefaultValue("60s") Duration timeout) {
	}

}
