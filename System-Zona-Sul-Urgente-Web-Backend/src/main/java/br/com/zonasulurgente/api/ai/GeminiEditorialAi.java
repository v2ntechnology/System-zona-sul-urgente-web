package br.com.zonasulurgente.api.ai;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import br.com.zonasulurgente.api.usage.QuotaDeferredException;
import br.com.zonasulurgente.api.usage.QuotaGuard;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Gemini pela API Interactions ({@code POST /v1beta/interactions}) com resposta em JSON Schema. O texto vem no
 * passo {@code model_output} de {@code steps}. A chave vai no cabeçalho {@code x-goog-api-key}, nunca na URL
 * (não aparece em log de acesso).
 */
class GeminiEditorialAi implements EditorialAiProvider {

	private static final Logger log = LoggerFactory.getLogger(GeminiEditorialAi.class);

	/** Folga para o raciocínio do modelo, que também conta como saída. */
	static final int MAX_OUTPUT_TOKENS = 8192;

	/**
	 * Novas tentativas em erro temporário (500/503: sobrecarga, comum no plano grátis), com espera crescente.
	 * Limite de uso (429) e tempo esgotado não repetem: o editor tenta depois.
	 */
	static final int TRANSIENT_RETRIES = 2;

	private final AiProperties.Gemini config;
	private final JsonMapper json;
	private final RestClient http;
	private final Duration retryDelay;
	private final QuotaGuard quota;

	/** Sem monitor de uso (teste ao vivo e testes do cliente do Gemini). */
	GeminiEditorialAi(AiProperties.Gemini config, JsonMapper json) {
		this(config, json, Duration.ofSeconds(2), NO_QUOTA);
	}

	GeminiEditorialAi(AiProperties.Gemini config, JsonMapper json, QuotaGuard quota) {
		this(config, json, Duration.ofSeconds(2), quota);
	}

	GeminiEditorialAi(AiProperties.Gemini config, JsonMapper json, Duration retryDelay) {
		this(config, json, retryDelay, NO_QUOTA);
	}

	/** Sem monitor de uso (testes do cliente do Gemini). */
	static final QuotaGuard NO_QUOTA = new QuotaGuard() {
		@Override
		public void check(String resource, long amount) {
		}

		@Override
		public void record(String resource, long amount) {
		}
	};

	GeminiEditorialAi(AiProperties.Gemini config, JsonMapper json, Duration retryDelay, QuotaGuard quota) {
		if (config.apiKey().isBlank()) {
			throw new IllegalStateException("zsu.ai.provider=gemini exige GEMINI_API_KEY (Google AI Studio)");
		}
		this.config = config;
		this.json = json;
		this.retryDelay = retryDelay;
		this.quota = quota;
		var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(10))
			.build());
		factory.setReadTimeout(config.timeout());
		this.http = RestClient.builder()
			.baseUrl(config.baseUrl().replaceAll("/+$", ""))
			.requestFactory(factory)
			.defaultHeader("x-goog-api-key", config.apiKey())
			.defaultHeader("Api-Revision", config.apiRevision())
			.build();
	}

	@Override
	public String name() {
		return "gemini:" + config.model();
	}

	/** Principal e, se ele não responder, o reserva. Resposta inválida não troca de modelo. */
	@Override
	public AiDraft draftFromPost(SourcePost post, EditorialContext context) {
		List<String> models = java.util.stream.Stream.of(config.model(), config.fallbackModel())
			.filter(m -> m != null && !m.isBlank())
			.distinct()
			.toList();
		QuotaDeferredException earliest = null;
		for (int i = 0;; i++) {
			try {
				return draft(models.get(i), quotaKey(i), post, context);
			}
			catch (QuotaDeferredException e) {
				// Cota do plano grátis deste modelo esgotada (spec 004): tenta o próximo; sem nenhum, espera o primeiro
				// que voltar.
				if (earliest == null || e.retryAt().isBefore(earliest.retryAt())) {
					earliest = e;
				}
				if (i + 1 >= models.size()) {
					throw earliest;
				}
				log.info("{}: cota do plano grátis esgotada ({}); usando o reserva {}", models.get(i), e.reason(),
						models.get(i + 1));
			}
			catch (AiUnavailableException e) {
				if (i + 1 >= models.size()) {
					if (earliest != null) {
						throw earliest;
					}
					throw e;
				}
				log.warn("{} não respondeu ({}); usando o reserva {}", models.get(i), e.getMessage(), models.get(i + 1));
			}
		}
	}

	/** Recursos do monitor de uso: o principal e o reserva têm cotas separadas no Gemini. */
	static String quotaKey(int modelIndex) {
		return modelIndex == 0 ? "ia.principal" : "ia.reserva";
	}

	private AiDraft draft(String model, String quotaKey, SourcePost post, EditorialContext context) {
		Map<String, Object> body = Map.of(
				"model", model,
				"system_instruction", EditorialPrompt.SYSTEM,
				"input", EditorialPrompt.input(post, context),
				"response_format", Map.of(
						"type", "text",
						"mime_type", "application/json",
						"schema", EditorialPrompt.schema(context)),
				"generation_config", Map.of("max_output_tokens", MAX_OUTPUT_TOKENS));

		String raw = call(body, quotaKey);
		JsonNode interaction = parse(raw, "a resposta do fornecedor não é JSON");
		String status = interaction.path("status").asString();
		if (!"completed".equals(status)) {
			log.warn("Gemini terminou com status {} ({})", status, model);
			throw new AiOutputException("a resposta terminou com status \"" + status + "\"");
		}
		JsonNode usage = interaction.path("usage");
		log.info("Resposta de {} (tokens: entrada {}, saída {})", model, usage.path("total_input_tokens").asInt(),
				usage.path("total_output_tokens").asInt());
		return AiDraftValidator.validate(parse(outputText(interaction), "o texto gerado não é JSON"), context,
				"gemini:" + model);
	}

	private String call(Map<String, Object> body, String quotaKey) {
		for (int attempt = 0;; attempt++) {
			try {
				// Cada chamada (inclusive nova tentativa) conta na cota do modelo: pergunta antes, conta depois.
				quota.check(quotaKey + ".minuto", 1);
				quota.check(quotaKey + ".dia", 1);
				quota.record(quotaKey + ".minuto", 1);
				quota.record(quotaKey + ".dia", 1);
				return send(body);
			}
			catch (RestClientResponseException e) {
				int status = e.getStatusCode().value();
				if ((status == 500 || status == 503) && attempt < TRANSIENT_RETRIES) {
					log.info("Gemini respondeu {}; nova tentativa ({}/{})", status, attempt + 1, TRANSIENT_RETRIES);
					sleep(retryDelay.multipliedBy(attempt + 1));
					continue;
				}
				throw failure(e);
			}
		}
	}

	private static void sleep(Duration delay) {
		try {
			Thread.sleep(delay);
		}
		catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new AiUnavailableException("A IA não respondeu. Tente de novo.");
		}
	}

	private String send(Map<String, Object> body) {
		try {
			return http.post()
				.uri("/v1beta/interactions")
				.contentType(MediaType.APPLICATION_JSON)
				.body(body)
				.retrieve()
				.body(String.class);
		}
		catch (ResourceAccessException e) {
			log.warn("Gemini inacessível: {}", e.getMessage());
			throw new AiUnavailableException("A IA não respondeu a tempo. Tente de novo.");
		}
	}

	private static AiUnavailableException failure(RestClientResponseException e) {
		// O corpo do erro do Google não traz a chave; vai para o log (curto) para diagnóstico.
		String detail = e.getResponseBodyAsString();
		int status = e.getStatusCode().value();
		log.warn("Gemini respondeu {}: {}", status, detail.length() > 500 ? detail.substring(0, 500) + "…" : detail);
		if (status == HttpStatus.TOO_MANY_REQUESTS.value()) {
			return new AiUnavailableException(
					"Limite de uso da IA atingido (plano gratuito). Tente de novo em alguns minutos.");
		}
		if (status == 500 || status == 503) {
			return new AiUnavailableException("A IA está sobrecarregada agora. Tente de novo em alguns minutos.");
		}
		return new AiUnavailableException("A IA respondeu com erro " + status + ".");
	}

	private JsonNode parse(String text, String reason) {
		try {
			return json.readTree(text == null ? "" : text);
		}
		catch (JacksonException e) {
			throw new AiOutputException(reason);
		}
	}

	/** Junta os textos dos passos {@code model_output} (pensamentos e chamadas de ferramenta ficam de fora). */
	static String outputText(JsonNode interaction) {
		var sb = new StringBuilder();
		interaction.path("steps").forEach(step -> {
			if ("model_output".equals(step.path("type").asString())) {
				step.path("content").forEach(block -> {
					if ("text".equals(block.path("type").asString())) {
						sb.append(block.path("text").asString());
					}
				});
			}
		});
		return sb.toString();
	}

}
