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

	/** Conexão com a conta (linha única da V10). O acesso vem cifrado; quem decifra é o serviço. */
	record Connection(String igUserId, String username, String tokenCipher, String tokenLast4,
			OffsetDateTime tokenExpiresAt, String status, String connectedByName, OffsetDateTime connectedAt,
			OffsetDateTime backfillSince, OffsetDateTime lastSyncAt, OffsetDateTime lastSuccessAt, String lastError,
			int failures) {
	}

	/** O que o job de importação precisa saber de um post. */
	record ImportTarget(String id, String source, String status, UUID newsId, String igMediaId, String igUserId,
			int storedMedia) {
	}

	/** Post já importado, para a conferência de legenda alterada / post apagado. */
	record Tracked(String id, String igMediaId, String caption, String currentCaption, String status) {
	}

	private static final String SELECT = """
			SELECT ip.*, n.title AS n_title, n.status AS n_status, n.summary AS n_summary, n.body::text AS n_body,
			       main.url AS main_url,
			       (SELECT array_agg(ma.url ORDER BY m.position) FROM instagram_post_media m
			        JOIN media_assets ma ON ma.id = m.media_asset_id WHERE m.post_id = ip.id) AS media_urls
			FROM instagram_posts ip LEFT JOIN news n ON n.id = ip.news_id
			LEFT JOIN media_assets main ON main.id = ip.main_media_id""";

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

	// ------------------------------------------------------------------ conexão com a conta (BE-013, spec 001)

	Optional<Connection> connection() {
		return jdbc.sql("""
				SELECT c.*, u.name AS connected_by_name FROM instagram_connection c
				LEFT JOIN users u ON u.id = c.connected_by WHERE c.id = 1""")
			.query((rs, i) -> new Connection(rs.getString("ig_user_id"), rs.getString("username"),
					rs.getString("token_cipher"), rs.getString("token_last4"),
					rs.getObject("token_expires_at", OffsetDateTime.class), rs.getString("status"),
					rs.getString("connected_by_name"), rs.getObject("connected_at", OffsetDateTime.class),
					rs.getObject("backfill_since", OffsetDateTime.class),
					rs.getObject("last_sync_at", OffsetDateTime.class),
					rs.getObject("last_success_at", OffsetDateTime.class), rs.getString("last_error"),
					rs.getInt("failures")))
			.optional();
	}

	/** Liga ou troca a conta (sobrescreve a linha única) e zera o histórico de sincronização. */
	void saveConnection(String igUserId, String username, String tokenCipher, String tokenLast4,
			OffsetDateTime tokenExpiresAt, UUID connectedBy, OffsetDateTime backfillSince) {
		jdbc.sql("""
				INSERT INTO instagram_connection (id, ig_user_id, username, token_cipher, token_last4, token_expires_at,
				  status, connected_by, connected_at, backfill_since)
				VALUES (1, :igUserId, :username, :cipher, :last4, :expires, 'ACTIVE', :by, now(), :since)
				ON CONFLICT (id) DO UPDATE SET ig_user_id = EXCLUDED.ig_user_id, username = EXCLUDED.username,
				  token_cipher = EXCLUDED.token_cipher, token_last4 = EXCLUDED.token_last4,
				  token_expires_at = EXCLUDED.token_expires_at, status = 'ACTIVE', connected_by = EXCLUDED.connected_by,
				  connected_at = now(), backfill_since = EXCLUDED.backfill_since, last_sync_at = NULL,
				  last_success_at = NULL, last_error = NULL, failures = 0""")
			.param("igUserId", igUserId)
			.param("username", username)
			.param("cipher", tokenCipher)
			.param("last4", tokenLast4)
			.param("expires", tokenExpiresAt)
			.param("by", connectedBy)
			.param("since", backfillSince)
			.update();
	}

	void deleteConnection() {
		jdbc.sql("DELETE FROM instagram_connection WHERE id = 1").update();
	}

	void syncSucceeded() {
		jdbc.sql("""
				UPDATE instagram_connection SET last_sync_at = now(), last_success_at = now(), last_error = NULL,
				  failures = 0 WHERE id = 1""").update();
	}

	/** Falha passageira: devolve quantas seguidas já são. */
	int syncFailed(String error) {
		return jdbc.sql("""
				UPDATE instagram_connection SET last_sync_at = now(), last_error = :error, failures = failures + 1
				WHERE id = 1 RETURNING failures""")
			.param("error", cut(error))
			.query(Integer.class)
			.optional()
			.orElse(0);
	}

	/** Acesso perdido. Verdadeiro só na primeira vez (para auditar uma vez). */
	boolean markRevoked(String error) {
		return jdbc.sql("""
				UPDATE instagram_connection SET status = 'REVOKED', last_sync_at = now(), last_error = :error
				WHERE id = 1 AND status = 'ACTIVE'""")
			.param("error", cut(error))
			.update() == 1;
	}

	// ------------------------------------------------------------------ posts vindos da API

	/** Já existe na fila? Pelo ID da Meta ou pelo link (manual). Devolve o id da linha. */
	Optional<String> findByMediaIdOrPermalink(String igMediaId, String permalink) {
		return jdbc.sql("""
				SELECT id FROM instagram_posts WHERE ig_media_id = :mediaId OR permalink = :permalink
				ORDER BY (ig_media_id = :mediaId) DESC NULLS LAST LIMIT 1""")
			.param("mediaId", igMediaId)
			.param("permalink", permalink)
			.query(String.class)
			.optional();
	}

	void insertFromApi(String igMediaId, String caption, String permalink, String mediaType, String productType,
			int mediaCount, OffsetDateTime postedAt, String igUserId) {
		jdbc.sql("""
				INSERT INTO instagram_posts (id, ig_media_id, caption, permalink, media_type, media_product_type,
				  media_count, posted_at, source, ig_user_id)
				VALUES (:id, :id, :caption, :permalink, :mediaType, :productType, :count, :postedAt, 'API', :igUserId)""")
			.param("id", igMediaId)
			.param("caption", caption)
			.param("permalink", permalink)
			.param("mediaType", mediaType)
			.param("productType", productType)
			.param("count", mediaCount)
			.param("postedAt", postedAt)
			.param("igUserId", igUserId)
			.update();
	}

	/** Post colado à mão que a varredura encontrou pelo link: ganha o ID da Meta, mas continua MANUAL. */
	void linkManual(String id, String igMediaId, String igUserId, String mediaType, String productType,
			int mediaCount) {
		jdbc.sql("""
				UPDATE instagram_posts SET ig_media_id = :mediaId, ig_user_id = :igUserId, media_type = :mediaType,
				  media_product_type = :productType, media_count = :count, updated_at = now()
				WHERE id = :id AND ig_media_id IS NULL""")
			.param("id", id)
			.param("mediaId", igMediaId)
			.param("igUserId", igUserId)
			.param("mediaType", mediaType)
			.param("productType", productType)
			.param("count", mediaCount)
			.update();
	}

	Optional<ImportTarget> importTarget(String id) {
		return jdbc.sql("""
				SELECT ip.id, ip.source, ip.status, ip.news_id, ip.ig_media_id, ip.ig_user_id,
				       (SELECT count(*) FROM instagram_post_media m WHERE m.post_id = ip.id) AS stored
				FROM instagram_posts ip WHERE ip.id = :id""")
			.param("id", id)
			.query((rs, i) -> new ImportTarget(rs.getString("id"), rs.getString("source"), rs.getString("status"),
					rs.getObject("news_id", UUID.class), rs.getString("ig_media_id"), rs.getString("ig_user_id"),
					rs.getInt("stored")))
			.optional();
	}

	/** Idempotente: a mesma posição não é gravada duas vezes. */
	boolean addMedia(String postId, int position, UUID mediaAssetId, String kind) {
		return jdbc.sql("""
				INSERT INTO instagram_post_media (post_id, position, media_asset_id, kind)
				VALUES (:post, :position, :asset, :kind) ON CONFLICT (post_id, position) DO NOTHING""")
			.param("post", postId)
			.param("position", position)
			.param("asset", mediaAssetId)
			.param("kind", kind)
			.update() == 1;
	}

	java.util.Set<Integer> mediaPositions(String postId) {
		return new java.util.HashSet<>(jdbc.sql("SELECT position FROM instagram_post_media WHERE post_id = :post")
			.param("post", postId)
			.query(Integer.class)
			.list());
	}

	/** Foto principal = a primeira guardada; sem nenhuma, o post precisa de foto escolhida à mão. */
	void refreshMainMedia(String postId) {
		jdbc.sql("""
				UPDATE instagram_posts ip SET
				  main_media_id = (SELECT media_asset_id FROM instagram_post_media WHERE post_id = ip.id
				                   ORDER BY position LIMIT 1),
				  needs_photo = NOT EXISTS (SELECT 1 FROM instagram_post_media WHERE post_id = ip.id),
				  updated_at = now()
				WHERE ip.id = :id""")
			.param("id", postId)
			.update();
	}

	/** Endereço da foto principal guardada (para o rascunho). */
	Optional<String> mainMediaUrl(String postId) {
		return jdbc.sql("""
				SELECT ma.url FROM instagram_posts ip JOIN media_assets ma ON ma.id = ip.main_media_id
				WHERE ip.id = :id""")
			.param("id", postId)
			.query(String.class)
			.optional();
	}

	Optional<String> igUserIdOf(String postId) {
		return jdbc.sql("SELECT ig_user_id FROM instagram_posts WHERE id = :id")
			.param("id", postId)
			.query((rs, i) -> Optional.ofNullable(rs.getString(1)))
			.optional()
			.flatMap(o -> o);
	}

	// ------------------------------------------------------------------ conferência (legenda alterada, post apagado)

	/** Posts já importados com ID da Meta, publicados a partir de {@code since}. */
	List<Tracked> tracked(String igUserId, OffsetDateTime since) {
		return jdbc.sql("""
				SELECT id, ig_media_id, caption, current_caption, status FROM instagram_posts
				WHERE ig_media_id IS NOT NULL AND ig_user_id = :igUserId AND posted_at >= :since
				  AND status IN ('IMPORTED', 'CHANGED_AT_SOURCE')""")
			.param("igUserId", igUserId)
			.param("since", since)
			.query((rs, i) -> new Tracked(rs.getString("id"), rs.getString("ig_media_id"), rs.getString("caption"),
					rs.getString("current_caption"), rs.getString("status")))
			.list();
	}

	/** Legenda mudou na origem: a original fica; a nova vai ao lado. */
	void markChanged(String id, String currentCaption) {
		jdbc.sql("""
				UPDATE instagram_posts SET status = 'CHANGED_AT_SOURCE', current_caption = :caption,
				  source_changed_at = now(), updated_at = now()
				WHERE id = :id AND status IN ('IMPORTED', 'CHANGED_AT_SOURCE')""")
			.param("id", id)
			.param("caption", currentCaption)
			.update();
	}

	void markRemoved(String id) {
		jdbc.sql("""
				UPDATE instagram_posts SET status = 'REMOVED_AT_SOURCE', source_changed_at = now(), updated_at = now()
				WHERE id = :id AND status IN ('IMPORTED', 'CHANGED_AT_SOURCE')""")
			.param("id", id)
			.update();
	}

	private static String cut(String value) {
		return value == null || value.length() <= 500 ? value : value.substring(0, 500);
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
				rs.getString("main_url") != null ? rs.getString("main_url") : rs.getString("thumbnail_url"),
				rs.getObject("posted_at", OffsetDateTime.class),
				rs.getString("status"),
				newsId == null ? null
						: new InstagramPostView.NewsRef(newsId, rs.getString("n_title"), rs.getString("n_status"),
								rs.getString("n_summary"), paragraphs(rs.getString("n_body"))),
				rs.getString("error"), attempts == 0 ? null : attempts, rs.getString("ignored_reason"),
				rs.getObject("source_changed_at", OffsetDateTime.class), rs.getString("source"),
				rs.getBoolean("needs_photo"), mediaUrls(rs));
	}

	private static List<String> mediaUrls(ResultSet rs) throws SQLException {
		java.sql.Array array = rs.getArray("media_urls");
		if (array == null) {
			return null;
		}
		List<String> urls = List.of((String[]) array.getArray());
		return urls.isEmpty() ? null : urls;
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
