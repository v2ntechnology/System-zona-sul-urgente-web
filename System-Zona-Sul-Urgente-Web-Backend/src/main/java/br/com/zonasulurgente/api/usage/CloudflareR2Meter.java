package br.com.zonasulurgente.api.usage;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import br.com.zonasulurgente.api.usage.UsageProperties.Meter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Uso do R2 pela API de métricas da Cloudflare (GraphQL, research.md R2): espaço atual de todos os buckets da conta
 * (o plano grátis é por conta) e operações de Classe A/B desde o início do mês (UTC). O token é só de leitura e
 * nunca aparece em log nem em resposta.
 */
@Component
class CloudflareR2Meter implements UsageMeter {

	static final String QUERY = """
			query ($account: string!, $storageSince: Time!, $monthStart: Time!, $now: Time!) {
			  viewer {
			    accounts(filter: { accountTag: $account }) {
			      storage: r2StorageAdaptiveGroups(limit: 10000,
			          filter: { datetime_geq: $storageSince, datetime_leq: $now }, orderBy: [datetime_DESC]) {
			        max { payloadSize metadataSize objectCount }
			        dimensions { bucketName datetime }
			      }
			      operations: r2OperationsAdaptiveGroups(limit: 10000,
			          filter: { datetime_geq: $monthStart, datetime_leq: $now }) {
			        sum { requests }
			        dimensions { actionType }
			      }
			    }
			  }
			}""";

	private final UsageProperties.Cloudflare config;
	private final JsonMapper json;
	private final RestClient http;

	CloudflareR2Meter(UsageProperties props, JsonMapper json) {
		this.config = props.cloudflare();
		this.json = json;
		var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(10))
			.build());
		factory.setReadTimeout(config.timeout());
		this.http = RestClient.builder().requestFactory(factory).build();
	}

	@Override
	public Set<Meter> meters() {
		return config.configured()
				? Set.of(Meter.CLOUDFLARE_R2_STORAGE, Meter.CLOUDFLARE_R2_CLASS_A, Meter.CLOUDFLARE_R2_CLASS_B)
				: Set.of();
	}

	@Override
	public Map<Meter, Reading> read() {
		OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.SECONDS);
		OffsetDateTime monthStart = now.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
		Map<String, Object> body = Map.of("query", QUERY, "variables", Map.of(
				"account", config.accountId(),
				"storageSince", now.minusDays(2).toString(),
				"monthStart", monthStart.toString(),
				"now", now.toString()));
		String raw;
		try {
			raw = http.post()
				.uri(config.graphqlUrl())
				.contentType(MediaType.APPLICATION_JSON)
				.header("Authorization", "Bearer " + config.apiToken())
				.body(body)
				.retrieve()
				.body(String.class);
		}
		catch (org.springframework.web.client.RestClientResponseException e) {
			throw new IllegalStateException("A Cloudflare respondeu " + e.getStatusCode().value() + ".");
		}
		catch (org.springframework.web.client.ResourceAccessException e) {
			throw new IllegalStateException("A Cloudflare não respondeu a tempo.");
		}
		JsonNode root = json.readTree(raw);
		JsonNode errors = root.path("errors");
		if (errors.isArray() && !errors.isEmpty()) {
			throw new IllegalStateException("Erro da Cloudflare: " + errors.get(0).path("message").asString());
		}
		JsonNode account = root.path("data").path("viewer").path("accounts").path(0);
		if (account.isMissingNode()) {
			throw new IllegalStateException("A Cloudflare não devolveu a conta (confira CLOUDFLARE_ACCOUNT_ID).");
		}

		// Espaço: a leitura mais recente de cada bucket (a lista vem da mais nova para a mais antiga).
		long storage = 0;
		Set<String> seen = new HashSet<>();
		for (JsonNode group : account.path("storage")) {
			String bucket = group.path("dimensions").path("bucketName").asString();
			if (seen.add(bucket)) {
				JsonNode max = group.path("max");
				storage += max.path("payloadSize").asLong() + max.path("metadataSize").asLong();
			}
		}
		long classA = 0;
		long classB = 0;
		for (JsonNode group : account.path("operations")) {
			String action = group.path("dimensions").path("actionType").asString();
			long requests = group.path("sum").path("requests").asLong();
			if (config.classA().contains(action)) {
				classA += requests;
			}
			else if (config.classB().contains(action)) {
				classB += requests;
			}
		}
		Map<Meter, Reading> out = new EnumMap<>(Meter.class);
		out.put(Meter.CLOUDFLARE_R2_STORAGE, new Reading(storage, null));
		out.put(Meter.CLOUDFLARE_R2_CLASS_A, new Reading(classA, null));
		out.put(Meter.CLOUDFLARE_R2_CLASS_B, new Reading(classB, null));
		return out;
	}

}
