package br.com.zonasulurgente.api.news.admin;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import br.com.zonasulurgente.api.shared.contract.CategoryRef;

/** Persistência do CRUD de notícias do painel (BE-009), em SQL direto. */
@Repository
class AdminNewsRepository {

	/** Estado atual de uma notícia (permissões e transições). */
	record Current(UUID id, String slug, String status, int version, boolean isUrgent, boolean isSponsored,
			OffsetDateTime publishedAt, OffsetDateTime deletedAt, UUID createdBy, String categorySlug,
			String parentSlug) {
	}

	/** Colunas gravadas por um salvamento. */
	record Fields(String slug, String title, String subtitle, String summary, String bodyJson, String bodyText,
			UUID categoryId, UUID cityId, UUID neighborhoodId, UUID imageId, String status, boolean isUrgent,
			boolean isSponsored, String sponsorName, String seoTitle, String seoDescription, int readingTime,
			OffsetDateTime publishedAt, OffsetDateTime scheduledFor, String origin) {
	}

	record Filter(String query, String status, String categorySlug, String origin, int page, int pageSize) {
	}

	record VersionRow(int version, OffsetDateTime createdAt, String createdBy) {
	}

	private final JdbcClient jdbc;

	AdminNewsRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	// ---------------------------------------------------------------- listagem

	AdminPage<AdminNewsRow> list(Filter f) {
		var where = new StringBuilder("WHERE ");
		var params = new HashMap<String, Object>();
		if ("DELETED".equals(f.status())) {
			where.append("n.deleted_at IS NOT NULL");
		}
		else {
			where.append("n.deleted_at IS NULL");
			if (f.status() != null) {
				where.append(" AND n.status = :status");
				params.put("status", f.status());
			}
		}
		if (f.categorySlug() != null) {
			where.append(" AND (c.slug = :cat OR p.slug = :cat)");
			params.put("cat", f.categorySlug());
		}
		if (f.origin() != null) {
			where.append(" AND n.origin = :origin");
			params.put("origin", f.origin());
		}
		if (f.query() != null && !f.query().isBlank()) {
			// Cada termo precisa aparecer no título ou no nome de um autor, sem diferenciar acento.
			int i = 0;
			for (String term : f.query().strip().split("\\s+")) {
				String key = "q" + i++;
				where.append(" AND (f_unaccent(n.title) ILIKE f_unaccent(:").append(key).append(")")
					.append(" OR EXISTS (SELECT 1 FROM news_authors na JOIN authors a ON a.id = na.author_id")
					.append(" WHERE na.news_id = n.id AND f_unaccent(a.name) ILIKE f_unaccent(:").append(key)
					.append(")))");
				params.put(key, "%" + term.replace("%", "").replace("_", "") + "%");
			}
		}
		String from = """
				FROM news n
				JOIN categories c ON c.id = n.category_id
				LEFT JOIN categories p ON p.id = c.parent_id
				""";
		long total = jdbc.sql("SELECT count(*) " + from + where).params(params).query(Long.class).single();
		int pageCount = (int) Math.max(1, Math.ceilDiv(total, f.pageSize()));
		int page = Math.min(Math.max(f.page(), 1), pageCount);
		params.put("limit", f.pageSize());
		params.put("offset", (page - 1) * f.pageSize());
		List<AdminNewsRow> rows = jdbc.sql("""
				SELECT n.id, n.slug, n.title, n.status, n.origin, n.is_urgent, n.is_sponsored, n.updated_at,
				       n.published_at, n.scheduled_for, n.deleted_at, coalesce(ns.views_total, 0) AS views,
				       m.url AS image_url, c.id AS c_id, c.slug AS c_slug, c.name AS c_name,
				       p.id AS p_id, p.slug AS p_slug, p.name AS p_name,
				       (SELECT string_agg(a.name, '|' ORDER BY na.position) FROM news_authors na
				          JOIN authors a ON a.id = na.author_id WHERE na.news_id = n.id) AS authors
				""" + from + """
				LEFT JOIN news_stats ns ON ns.news_id = n.id
				LEFT JOIN media_assets m ON m.id = n.image_id
				""" + where + " ORDER BY n.updated_at DESC, n.id DESC LIMIT :limit OFFSET :offset")
			.params(params)
			.query((rs, i) -> row(rs))
			.list();
		return new AdminPage<>(rows, total, page, pageCount);
	}

	Map<String, Long> counts() {
		Map<String, Long> counts = new LinkedHashMap<>();
		counts.put("ALL", 0L);
		counts.put("DELETED", 0L);
		jdbc.sql("""
				SELECT CASE WHEN deleted_at IS NOT NULL THEN 'DELETED' ELSE status END AS k, count(*)
				FROM news GROUP BY 1""")
			.query((ResultSet rs) -> {
				String k = rs.getString(1);
				long n = rs.getLong(2);
				counts.merge(k, n, Long::sum);
				if (!"DELETED".equals(k)) {
					counts.merge("ALL", n, Long::sum);
				}
			});
		return counts;
	}

	// ---------------------------------------------------------------- leitura para o editor

	Optional<Current> current(UUID id) {
		return jdbc.sql("""
				SELECT n.id, n.slug, n.status, n.version, n.is_urgent, n.is_sponsored, n.published_at,
				       n.deleted_at, n.created_by, c.slug AS c_slug, p.slug AS p_slug
				FROM news n JOIN categories c ON c.id = n.category_id LEFT JOIN categories p ON p.id = c.parent_id
				WHERE n.id = :id FOR UPDATE OF n""")
			.param("id", id)
			.query((rs, i) -> new Current(rs.getObject("id", UUID.class), rs.getString("slug"),
					rs.getString("status"), rs.getInt("version"), rs.getBoolean("is_urgent"),
					rs.getBoolean("is_sponsored"), rs.getObject("published_at", OffsetDateTime.class),
					rs.getObject("deleted_at", OffsetDateTime.class), rs.getObject("created_by", UUID.class),
					rs.getString("c_slug"), rs.getString("p_slug")))
			.optional();
	}

	Optional<NewsDraft.Out> draft(UUID id) {
		return jdbc.sql("""
				SELECT n.*, n.body::text AS body_json, c.slug AS c_slug, nb.slug AS nb_slug,
				       m.url AS m_url, m.alt AS m_alt, m.caption AS m_caption, m.credit AS m_credit
				FROM news n
				JOIN categories c ON c.id = n.category_id
				LEFT JOIN neighborhoods nb ON nb.id = n.neighborhood_id
				LEFT JOIN media_assets m ON m.id = n.image_id
				WHERE n.id = :id""")
			.param("id", id)
			.query((rs, i) -> {
				OffsetDateTime scheduled = rs.getObject("scheduled_for", OffsetDateTime.class);
				return new NewsDraft.Out(rs.getObject("id", UUID.class), rs.getString("title"),
						nz(rs.getString("subtitle")), rs.getString("summary"), rs.getString("body_json"),
						rs.getString("c_slug"), authorSlugs(id), nz(rs.getString("nb_slug")), tagSlugs(id), List.of(),
						new NewsDraft.Image(nz(rs.getString("m_url")), nz(rs.getString("m_alt")),
								nz(rs.getString("m_caption")), nz(rs.getString("m_credit"))),
						rs.getBoolean("is_urgent"), rs.getBoolean("is_sponsored"), nz(rs.getString("sponsor_name")),
						new NewsDraft.Seo(nz(rs.getString("seo_title")), nz(rs.getString("seo_description"))),
						rs.getString("status"),
						scheduled == null ? ""
								: scheduled.atZoneSameInstant(DraftValidator.BRASILIA).toLocalDateTime().toString()
									.substring(0, 16),
						rs.getString("origin"), null, rs.getObject("updated_at", OffsetDateTime.class),
						rs.getInt("version"));
			})
			.optional();
	}

	List<String> authorSlugs(UUID newsId) {
		return jdbc.sql("""
				SELECT a.slug FROM news_authors na JOIN authors a ON a.id = na.author_id
				WHERE na.news_id = :id ORDER BY na.position""").param("id", newsId).query(String.class).list();
	}

	List<String> tagSlugs(UUID newsId) {
		return jdbc.sql("SELECT t.slug FROM news_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.news_id = :id ORDER BY t.name")
			.param("id", newsId)
			.query(String.class)
			.list();
	}

	/** "Própria" = a pessoa é autora (pelo autor vinculado) ou criou a notícia. */
	boolean isOwn(UUID newsId, UUID userId, String authorSlug) {
		return jdbc.sql("""
				SELECT EXISTS (SELECT 1 FROM news WHERE id = :id AND created_by = :user)
				    OR EXISTS (SELECT 1 FROM news_authors na JOIN authors a ON a.id = na.author_id
				               WHERE na.news_id = :id AND a.slug = :author)""")
			.param("id", newsId)
			.param("user", userId)
			.param("author", authorSlug == null ? "" : authorSlug)
			.query(Boolean.class)
			.single();
	}

	// ---------------------------------------------------------------- referências

	Optional<UUID> categoryId(String slug) {
		return jdbc.sql("SELECT id FROM categories WHERE slug = :s AND active").param("s", slug).query(UUID.class).optional();
	}

	/** Bairro → (bairro, cidade). */
	Optional<UUID[]> neighborhood(String slug) {
		return jdbc.sql("""
				SELECT nb.id, z.city_id FROM neighborhoods nb JOIN zones z ON z.id = nb.zone_id WHERE nb.slug = :s""")
			.param("s", slug)
			.query((rs, i) -> new UUID[] { rs.getObject(1, UUID.class), rs.getObject(2, UUID.class) })
			.optional();
	}

	Map<String, UUID> authorIds(List<String> slugs) {
		return idsBySlug("SELECT slug, id FROM authors WHERE active AND slug IN (:s)", slugs);
	}

	Map<String, UUID> tagIds(List<String> slugs) {
		return idsBySlug("SELECT slug, id FROM tags WHERE slug IN (:s)", slugs);
	}

	/** Tópico novo: reaproveita o existente de mesmo nome normalizado; senão cria. */
	UUID ensureTag(String name) {
		String key = TagKeys.key(name);
		for (var row : jdbc.sql("SELECT id, name, slug FROM tags").query((rs, i) -> new Object[] {
				rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3) }).list()) {
			if (TagKeys.key((String) row[1]).equals(key) || TagKeys.key((String) row[2]).equals(key)) {
				return (UUID) row[0];
			}
		}
		String base = TagKeys.slug(name);
		String slug = base;
		for (int i = 2; exists("tags", slug); i++) {
			slug = base + "-" + i;
		}
		return jdbc.sql("INSERT INTO tags (slug, name) VALUES (:slug, :name) RETURNING id")
			.param("slug", slug)
			.param("name", name.strip())
			.query(UUID.class)
			.single();
	}

	/** Foto principal por endereço (dimensões reais entram com o armazenamento de mídia, BE-012). */
	UUID imageAsset(NewsDraft.Image image) {
		return jdbc.sql("""
				INSERT INTO media_assets (url, width, height, alt, caption, credit)
				VALUES (:url, 1200, 675, :alt, :caption, :credit) RETURNING id""")
			.param("url", image.url().strip())
			.param("alt", image.alt() == null || image.alt().isBlank() ? "Foto da matéria" : image.alt().strip())
			.param("caption", blankToNull(image.caption()))
			.param("credit", blankToNull(image.credit()))
			.query(UUID.class)
			.single();
	}

	String uniqueSlug(String base, UUID except) {
		String slug = base.isEmpty() ? "noticia" : base;
		String candidate = slug;
		for (int i = 2; jdbc.sql("SELECT EXISTS (SELECT 1 FROM news WHERE slug = :s AND id <> :id)")
			.param("s", candidate)
			.param("id", except == null ? new UUID(0, 0) : except)
			.query(Boolean.class)
			.single(); i++) {
			candidate = slug + "-" + i;
		}
		return candidate;
	}

	// ---------------------------------------------------------------- escrita

	UUID insert(Fields f, UUID userId) {
		return jdbc.sql("""
				INSERT INTO news (slug, title, subtitle, summary, body, body_text, category_id, city_id,
				  neighborhood_id, image_id, status, is_urgent, is_sponsored, sponsor_name, seo_title,
				  seo_description, reading_time_minutes, published_at, scheduled_for, origin, created_by, updated_by,
				  version)
				VALUES (:slug, :title, :subtitle, :summary, :body::jsonb, :bodyText, :cat, :city, :nb, :image,
				  :status, :urgent, :sponsored, :sponsor, :seoTitle, :seoDescription, :reading,
				  CASE WHEN :status = 'PUBLISHED' THEN coalesce(:publishedAt, now()) ELSE :publishedAt END,
				  :scheduledFor, :origin, :user, :user, 1)
				RETURNING id""")
			.params(params(f))
			.param("user", userId)
			.query(UUID.class)
			.single();
	}

	/** Atualiza se a versão bater (bloqueio otimista); devolve false se outra pessoa salvou antes. */
	boolean update(UUID id, int expectedVersion, Fields f, UUID userId) {
		return jdbc.sql("""
				UPDATE news SET slug = :slug, title = :title, subtitle = :subtitle, summary = :summary,
				  body = :body::jsonb, body_text = :bodyText, category_id = :cat, city_id = :city,
				  neighborhood_id = :nb, image_id = :image, status = :status, is_urgent = :urgent,
				  is_sponsored = :sponsored, sponsor_name = :sponsor, seo_title = :seoTitle,
				  seo_description = :seoDescription, reading_time_minutes = :reading,
				  published_at = CASE WHEN :status = 'PUBLISHED' THEN coalesce(:publishedAt, now()) ELSE :publishedAt END,
				  scheduled_for = :scheduledFor, updated_by = :user, updated_at = now(), version = version + 1
				WHERE id = :id AND version = :version""")
			.params(params(f))
			.param("id", id)
			.param("version", expectedVersion)
			.param("user", userId)
			.update() == 1;
	}

	void replaceAuthors(UUID newsId, List<UUID> authorIds) {
		jdbc.sql("DELETE FROM news_authors WHERE news_id = :id").param("id", newsId).update();
		for (int i = 0; i < authorIds.size(); i++) {
			jdbc.sql("INSERT INTO news_authors (news_id, author_id, position) VALUES (:n, :a, :p)")
				.param("n", newsId).param("a", authorIds.get(i)).param("p", i).update();
		}
	}

	void replaceTags(UUID newsId, List<UUID> tagIds) {
		jdbc.sql("DELETE FROM news_tags WHERE news_id = :id").param("id", newsId).update();
		for (UUID tag : tagIds.stream().distinct().toList()) {
			jdbc.sql("INSERT INTO news_tags (news_id, tag_id) VALUES (:n, :t)").param("n", newsId).param("t", tag).update();
		}
	}

	/** Agendadas cujo horário chegou; outra instância não pega as mesmas (SKIP LOCKED). */
	List<UUID> dueScheduled(int limit) {
		return jdbc.sql("""
				SELECT id FROM news WHERE status = 'SCHEDULED' AND deleted_at IS NULL AND scheduled_for <= now()
				ORDER BY scheduled_for LIMIT :limit FOR UPDATE SKIP LOCKED""")
			.param("limit", limit)
			.query(UUID.class)
			.list();
	}

	/** Troca de status/lixeira sem mudar o conteúdo (também conta versão). */
	int changeState(UUID id, String setClause, Map<String, ?> params, UUID userId) {
		var all = new HashMap<String, Object>(params);
		all.put("id", id);
		all.put("user", userId);
		return jdbc.sql("UPDATE news SET " + setClause
				+ ", updated_by = :user, updated_at = now(), version = version + 1 WHERE id = :id")
			.params(all)
			.update();
	}

	void saveVersion(UUID newsId, int version, String snapshotJson, UUID userId) {
		jdbc.sql("""
				INSERT INTO news_versions (news_id, version, snapshot, created_by)
				VALUES (:id, :v, :snapshot::jsonb, :user) ON CONFLICT (news_id, version) DO NOTHING""")
			.param("id", newsId).param("v", version).param("snapshot", snapshotJson).param("user", userId).update();
	}

	List<VersionRow> versions(UUID newsId) {
		return jdbc.sql("""
				SELECT v.version, v.created_at, u.name FROM news_versions v LEFT JOIN users u ON u.id = v.created_by
				WHERE v.news_id = :id ORDER BY v.version DESC LIMIT 50""")
			.param("id", newsId)
			.query((rs, i) -> new VersionRow(rs.getInt(1), rs.getObject(2, OffsetDateTime.class), rs.getString(3)))
			.list();
	}

	// ---------------------------------------------------------------- internos

	private Map<String, Object> params(Fields f) {
		var p = new HashMap<String, Object>();
		p.put("slug", f.slug());
		p.put("title", f.title());
		p.put("subtitle", blankToNull(f.subtitle()));
		p.put("summary", f.summary());
		p.put("body", f.bodyJson());
		p.put("bodyText", f.bodyText());
		p.put("cat", f.categoryId());
		p.put("city", f.cityId());
		p.put("nb", f.neighborhoodId());
		p.put("image", f.imageId());
		p.put("status", f.status());
		p.put("urgent", f.isUrgent());
		p.put("sponsored", f.isSponsored());
		p.put("sponsor", blankToNull(f.sponsorName()));
		p.put("seoTitle", blankToNull(f.seoTitle()));
		p.put("seoDescription", blankToNull(f.seoDescription()));
		p.put("reading", f.readingTime());
		p.put("publishedAt", f.publishedAt());
		p.put("scheduledFor", f.scheduledFor());
		p.put("origin", f.origin());
		return p;
	}

	private Map<String, UUID> idsBySlug(String sql, List<String> slugs) {
		Map<String, UUID> ids = new LinkedHashMap<>();
		if (slugs == null || slugs.isEmpty()) {
			return ids;
		}
		jdbc.sql(sql).param("s", slugs).query((ResultSet rs) -> {
			ids.put(rs.getString(1), rs.getObject(2, UUID.class));
		});
		return ids;
	}

	private boolean exists(String table, String slug) {
		return jdbc.sql("SELECT EXISTS (SELECT 1 FROM " + table + " WHERE slug = :s)").param("s", slug)
			.query(Boolean.class).single();
	}

	private static AdminNewsRow row(ResultSet rs) throws SQLException {
		UUID parentId = rs.getObject("p_id", UUID.class);
		String authors = rs.getString("authors");
		return new AdminNewsRow(rs.getObject("id", UUID.class), rs.getString("slug"), rs.getString("title"),
				rs.getString("status"),
				new AdminNewsRow.Category(rs.getObject("c_id", UUID.class), rs.getString("c_slug"),
						rs.getString("c_name"),
						parentId == null ? null : new CategoryRef(parentId, rs.getString("p_slug"), rs.getString("p_name"))),
				authors == null ? List.of() : new ArrayList<>(List.of(authors.split("\\|"))), rs.getString("origin"),
				rs.getBoolean("is_urgent"), rs.getBoolean("is_sponsored"),
				rs.getObject("updated_at", OffsetDateTime.class), rs.getObject("published_at", OffsetDateTime.class),
				rs.getObject("scheduled_for", OffsetDateTime.class), rs.getObject("deleted_at", OffsetDateTime.class),
				rs.getLong("views"), rs.getString("image_url"));
	}

	private static String nz(String value) {
		return value == null ? "" : value;
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

}
