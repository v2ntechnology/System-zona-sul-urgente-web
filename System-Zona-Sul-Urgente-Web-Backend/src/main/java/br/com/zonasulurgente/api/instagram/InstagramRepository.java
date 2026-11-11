package br.com.zonasulurgente.api.instagram;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.jsoup.Jsoup;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import br.com.zonasulurgente.api.ai.EditorialContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Fila do Instagram (V8). Leitura já no formato da tela, com a notícia gerada quando houver. */
@Repository
class InstagramRepository {

	/** Estado mínimo para decidir uma ação. */
	record Current(String id, String caption, String permalink, OffsetDateTime postedAt, String status, UUID newsId,
			int attempts) {
	}

	private static final String SELECT = """
			SELECT ip.*, n.title AS n_title, n.status AS n_status, n.summary AS n_summary, n.body::text AS n_body
			FROM instagram_posts ip LEFT JOIN news n ON n.id = ip.news_id""";

	private final JdbcClient jdbc;
	private final JsonMapper json;

	InstagramRepository(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	List<InstagramPostView> list(String status) {
		return jdbc.sql(SELECT + (status == null ? "" : " WHERE ip.status = :status")
				+ " ORDER BY ip.posted_at DESC, ip.id LIMIT 200")
			.params(status == null ? Map.of() : Map.of("status", status))
			.query(this::toView)
			.list();
	}

	Optional<InstagramPostView> view(String id) {
		return jdbc.sql(SELECT + " WHERE ip.id = :id").param("id", id).query(this::toView).optional();
	}

	Map<String, Long> counts() {
		Map<String, Long> counts = new LinkedHashMap<>();
		counts.put("ALL", 0L);
		jdbc.sql("SELECT status, count(*) AS n FROM instagram_posts GROUP BY status")
			.query((rs, i) -> Map.entry(rs.getString("status"), rs.getLong("n")))
			.list()
			.forEach(e -> {
				counts.put(e.getKey(), e.getValue());
				counts.merge("ALL", e.getValue(), Long::sum);
			});
		return counts;
	}

	Optional<Current> current(String id) {
		return jdbc.sql("""
				SELECT id, caption, permalink, posted_at, status, news_id, attempts
				FROM instagram_posts WHERE id = :id""")
			.param("id", id)
			.query((rs, i) -> new Current(rs.getString("id"), rs.getString("caption"), rs.getString("permalink"),
					rs.getObject("posted_at", OffsetDateTime.class), rs.getString("status"),
					rs.getObject("news_id", UUID.class), rs.getInt("attempts")))
			.optional();
	}

	boolean exists(String id, String permalink) {
		return jdbc.sql("SELECT count(*) FROM instagram_posts WHERE id = :id OR permalink = :permalink")
			.param("id", id)
			.param("permalink", permalink)
			.query(Long.class)
			.single() > 0;
	}

	void insertManual(String id, String caption, String permalink, String mediaType, OffsetDateTime postedAt,
			UUID user) {
		jdbc.sql("""
				INSERT INTO instagram_posts (id, caption, permalink, media_type, posted_at, source, created_by)
				VALUES (:id, :caption, :permalink, :mediaType, :postedAt, 'MANUAL', :user)""")
			.param("id", id)
			.param("caption", caption)
			.param("permalink", permalink)
			.param("mediaType", mediaType)
			.param("postedAt", postedAt)
			.param("user", user)
			.update();
	}

	/** Liga a notícia gerada. Falso se outra requisição já ligou uma (clique duplo). */
	boolean markImported(String id, UUID newsId, String provider, String aiOutput) {
		return jdbc.sql("""
				UPDATE instagram_posts
				SET status = 'IMPORTED', news_id = :news, ai_provider = :provider, ai_output = :output::jsonb,
				    error = NULL, attempts = attempts + 1, updated_at = now()
				WHERE id = :id AND news_id IS NULL""")
			.param("id", id)
			.param("news", newsId)
			.param("provider", provider)
			.param("output", aiOutput)
			.update() == 1;
	}

	void markError(String id, String error) {
		jdbc.sql("""
				UPDATE instagram_posts
				SET status = 'ERROR', error = :error, attempts = attempts + 1, updated_at = now()
				WHERE id = :id AND news_id IS NULL""")
			.param("id", id)
			.param("error", error.length() > 500 ? error.substring(0, 500) : error)
			.update();
	}

	void setStatus(String id, String status, String ignoredReason) {
		jdbc.sql("""
				UPDATE instagram_posts SET status = :status, ignored_reason = :reason, updated_at = now()
				WHERE id = :id""")
			.param("id", id)
			.param("status", status)
			.param("reason", ignoredReason)
			.update();
	}

	/** "Marcar como revisado": a legenda nova da origem foi vista; a notícia segue como está. */
	void acknowledge(String id) {
		jdbc.sql("""
				UPDATE instagram_posts SET status = 'IMPORTED', source_changed_at = NULL, updated_at = now()
				WHERE id = :id AND status = 'CHANGED_AT_SOURCE'""")
			.param("id", id)
			.update();
	}

	/**
	 * O que a IA pode escolher: editorias ativas na ordem do site (sem Blogs e colunas, que são assinadas por
	 * colunistas) e todos os bairros. A primeira editoria é a reserva quando a IA não escolhe uma válida.
	 */
	EditorialContext editorialContext() {
		var categories = jdbc.sql("""
				SELECT c.slug, c.name, p.name AS parent
				FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
				WHERE c.active AND (p.id IS NULL OR p.active) AND c.columnist_id IS NULL
				  AND c.slug <> 'colunas' AND coalesce(p.slug, '') <> 'colunas'
				ORDER BY coalesce(p.sort_order, c.sort_order), p.id NULLS FIRST, c.sort_order, c.name""")
			.query((rs, i) -> new EditorialContext.Option(rs.getString("slug"),
					rs.getString("parent") == null ? rs.getString("name")
							: rs.getString("name") + " (" + rs.getString("parent") + ")"))
			.list();
		var neighborhoods = jdbc.sql("SELECT slug, name FROM neighborhoods ORDER BY name")
			.query((rs, i) -> new EditorialContext.Option(rs.getString("slug"), rs.getString("name")))
			.list();
		return new EditorialContext(categories, neighborhoods);
	}

	private InstagramPostView toView(ResultSet rs, int row) throws SQLException {
		UUID newsId = rs.getObject("news_id", UUID.class);
		int attempts = rs.getInt("attempts");
		return new InstagramPostView(rs.getString("id"), rs.getString("caption"), rs.getString("current_caption"),
				rs.getString("permalink"), rs.getString("media_type"), rs.getInt("media_count"),
				rs.getString("thumbnail_url"), rs.getObject("posted_at", OffsetDateTime.class),
				rs.getString("status"),
				newsId == null ? null
						: new InstagramPostView.NewsRef(newsId, rs.getString("n_title"), rs.getString("n_status"),
								rs.getString("n_summary"), paragraphs(rs.getString("n_body"))),
				rs.getString("error"), attempts == 0 ? null : attempts, rs.getString("ignored_reason"),
				rs.getObject("source_changed_at", OffsetDateTime.class));
	}

	private List<String> paragraphs(String body) {
		List<String> out = new ArrayList<>();
		if (body == null) {
			return out;
		}
		for (JsonNode block : json.readTree(body)) {
			if ("paragraph".equals(block.path("type").asString())) {
				out.add(Jsoup.parse(block.path("html").asString()).text());
			}
		}
		return out;
	}

}
