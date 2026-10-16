package br.com.zonasulurgente.api.news.admin;

import java.util.ArrayList;
import java.util.List;

import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import br.com.zonasulurgente.api.site.CacheInvalidateJob;

/**
 * Notícia mudou e isso aparece no site → job CACHE_INVALIDATE (BE-011). Roda DENTRO da
 * transação da mudança (outbox): se ela não for gravada, o job também não é.
 */
@Component
class NewsSiteRevalidation {

	private final JdbcClient jdbc;
	private final CacheInvalidateJob cache;

	NewsSiteRevalidation(JdbcClient jdbc, CacheInvalidateJob cache) {
		this.jdbc = jdbc;
		this.cache = cache;
	}

	@EventListener
	void on(NewsChangedEvent event) {
		if (!event.affectsSite()) {
			return;
		}
		// Mesmas tags que o site usa em src/services/api/public-api.ts.
		List<String> tags = new ArrayList<>(List.of("news:" + event.slug(), "news", "home", "breaking"));
		if (event.previousSlug() != null) {
			tags.add("news:" + event.previousSlug());
		}
		jdbc.sql("""
				SELECT c.slug, p.slug, nb.slug, ci.slug FROM news n
				JOIN categories c ON c.id = n.category_id
				LEFT JOIN categories p ON p.id = c.parent_id
				LEFT JOIN neighborhoods nb ON nb.id = n.neighborhood_id
				LEFT JOIN cities ci ON ci.id = n.city_id
				WHERE n.id = :id""")
			.param("id", event.newsId())
			.query((rs, i) -> {
				tags.add("category:" + rs.getString(1));
				if (rs.getString(2) != null) {
					tags.add("category:" + rs.getString(2));
				}
				if (rs.getString(3) != null) {
					tags.add("neighborhood:" + rs.getString(3));
				}
				if (rs.getString(4) != null) {
					tags.add("city:" + rs.getString(4));
				}
				return 0;
			})
			.list();
		cache.enqueue(tags);
	}

}
