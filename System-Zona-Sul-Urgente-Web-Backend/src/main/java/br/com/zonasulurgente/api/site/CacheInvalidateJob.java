package br.com.zonasulurgente.api.site;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import br.com.zonasulurgente.api.jobs.JobHandler;
import br.com.zonasulurgente.api.jobs.JobQueue;
import tools.jackson.databind.JsonNode;

/**
 * Job CACHE_INVALIDATE (ARCHITECTURE §11): avisa o Next (POST /api/revalidate) quais cache tags
 * mudaram. As tags seguem {@code src/lib/cache-tags.ts} do frontend. A purga da Cloudflare entra
 * aqui, depois do Next, quando o domínio estiver configurado (OPS).
 */
@Component
public class CacheInvalidateJob implements JobHandler {

	public static final String TYPE = "CACHE_INVALIDATE";

	/** Limite da rota do Next por requisição. */
	static final int MAX_TAGS = 50;

	private static final Logger log = LoggerFactory.getLogger(CacheInvalidateJob.class);

	private final SiteProperties props;
	private final JobQueue queue;
	private final RestClient http;

	public CacheInvalidateJob(SiteProperties props, JobQueue queue) {
		this.props = props;
		this.queue = queue;
		// HTTP/1.1: em http:// o cliente do JDK tenta o upgrade para HTTP/2 (h2c), que o Node recusa
		// fechando a conexão ("header parser received no bytes").
		var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
			.version(HttpClient.Version.HTTP_1_1)
			.connectTimeout(props.timeout())
			.build());
		factory.setReadTimeout(props.timeout());
		this.http = RestClient.builder().requestFactory(factory).build();
	}

	/** Agenda a revalidação na transação atual (sai junto com a mudança, ou não sai). */
	public void enqueue(List<String> tags) {
		List<String> unique = tags.stream().filter(t -> t != null && !t.isBlank()).distinct().toList();
		for (int i = 0; i < unique.size(); i += MAX_TAGS) {
			queue.enqueue(TYPE, Map.of("tags", unique.subList(i, Math.min(i + MAX_TAGS, unique.size()))));
		}
	}

	@Override
	public String type() {
		return TYPE;
	}

	@Override
	public void handle(JsonNode payload) {
		List<String> tags = new ArrayList<>();
		payload.path("tags").forEach(t -> tags.add(t.asString()));
		if (!props.revalidationEnabled()) {
			log.debug("Revalidação desligada (zsu.site.*): tags {} ignoradas", tags);
			return;
		}
		http.post()
			.uri(props.revalidateUrl().replaceAll("/+$", "") + "/api/revalidate")
			.header("Authorization", "Bearer " + props.revalidateSecret())
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("tags", tags))
			.retrieve()
			.toBodilessEntity();
		log.info("Site revalidado: {}", tags);
	}

}
