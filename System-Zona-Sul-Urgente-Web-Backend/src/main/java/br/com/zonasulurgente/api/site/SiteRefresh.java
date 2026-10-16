package br.com.zonasulurgente.api.site;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Avisa o site do que mudou fora das notícias (editorias, tópicos, autores): enfileira
 * CACHE_INVALIDATE na transação atual. Mudar o nome de uma editoria, tópico ou autor muda
 * as páginas das matérias que o exibem, por isso entram as tags news:{slug} delas.
 */
@Component
public class SiteRefresh {

	private final JdbcClient jdbc;
	private final CacheInvalidateJob cache;

	SiteRefresh(JdbcClient jdbc, CacheInvalidateJob cache) {
		this.jdbc = jdbc;
		this.cache = cache;
	}

	/** Menu, home e listas (mudou a taxonomia). */
	public void taxonomy(String... extraTags) {
		List<String> tags = new ArrayList<>(List.of("taxonomy", "home", "news", "breaking"));
		tags.addAll(List.of(extraTags));
		cache.enqueue(tags);
	}

	/** Matérias no ar que casam com {@code where} (alias n = news), mais as tags extras. */
	public void publishedNews(String where, Map<String, ?> params, String... extraTags) {
		List<String> tags = new ArrayList<>(List.of("taxonomy", "home", "news", "breaking"));
		tags.addAll(List.of(extraTags));
		jdbc.sql("SELECT n.slug FROM news n WHERE n.status = 'PUBLISHED' AND n.deleted_at IS NULL AND (" + where + ")")
			.params(params)
			.query(String.class)
			.list()
			.forEach(slug -> tags.add("news:" + slug));
		cache.enqueue(tags);
	}

}
