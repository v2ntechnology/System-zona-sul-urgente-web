package br.com.zonasulurgente.api.news.infrastructure;

import static br.com.zonasulurgente.api.taxonomy.infrastructure.TaxonomyReadRepository.CATEGORY_COLUMNS;
import static br.com.zonasulurgente.api.taxonomy.infrastructure.TaxonomyReadRepository.CATEGORY_JOINS;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import br.com.zonasulurgente.api.shared.contract.Author;
import br.com.zonasulurgente.api.shared.contract.City;
import br.com.zonasulurgente.api.shared.contract.MediaAsset;
import br.com.zonasulurgente.api.shared.contract.NewsLocation;
import br.com.zonasulurgente.api.shared.contract.NewsSeo;
import br.com.zonasulurgente.api.shared.contract.NewsSummary;
import br.com.zonasulurgente.api.shared.contract.Sponsor;
import br.com.zonasulurgente.api.shared.contract.Tag;
import br.com.zonasulurgente.api.shared.web.Cursor;
import br.com.zonasulurgente.api.taxonomy.infrastructure.TaxonomyReadRepository;

/**
 * Leitura pública de notícias (BE-004/BE-005), em SQL direto. Toda consulta parte de
 * {@link #PUBLIC}: só publicadas, não excluídas e já liberadas (agendadas no futuro não vazam).
 */
@Repository
public class NewsReadRepository {

	private static final String SUMMARY_SELECT = """
			SELECT n.id, n.slug, n.title, n.subtitle, n.summary, n.is_urgent, n.is_sponsored,
			       n.published_at, n.updated_at, (n.video IS NOT NULL) AS has_video,
			""" + CATEGORY_COLUMNS + """
			,
			       ci.id AS ci_id, ci.slug AS ci_slug, ci.name AS ci_name, ci.state AS ci_state,
			       nb.id AS nb_id, nb.slug AS nb_slug, nb.name AS nb_name,
			       z.id AS z_id, z.slug AS z_slug, z.name AS z_name, zc.slug AS nb_city_slug,
			       m.id AS m_id, m.url AS m_url, m.width AS m_width, m.height AS m_height,
			       m.alt AS m_alt, m.caption AS m_caption, m.credit AS m_credit
			FROM news n
			JOIN categories c ON c.id = n.category_id
			""" + CATEGORY_JOINS + """

			LEFT JOIN cities ci ON ci.id = n.city_id
			LEFT JOIN neighborhoods nb ON nb.id = n.neighborhood_id
			LEFT JOIN zones z ON z.id = nb.zone_id
			LEFT JOIN cities zc ON zc.id = z.city_id
			LEFT JOIN media_assets m ON m.id = n.image_id
			""";

	/** Filtro base de tudo que é público. */
	public static final String PUBLIC = """
			n.status = 'PUBLISHED' AND n.deleted_at IS NULL AND n.published_at <= now()""";

	/** Notícia completa: resumo + campos do corpo. */
	public record Detail(NewsSummary summary, UUID categoryId, String body, String video,
			Sponsor sponsor, int readingTimeMinutes, String origin, NewsSeo seo) {
	}

	private final JdbcClient jdbc;

	public NewsReadRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * Página por data (keyset). {@code where} é um trecho fixo do código (nunca entrada do
	 * usuário); valores vão sempre por parâmetro.
	 */
	public List<NewsSummary> page(String where, Map<String, ?> params, Cursor.Keyset after, int limit) {
		var sql = new StringBuilder(SUMMARY_SELECT).append(" WHERE ").append(PUBLIC);
		if (where != null) {
			sql.append(" AND (").append(where).append(')');
		}
		var all = new HashMap<String, Object>(params);
		if (after != null) {
			sql.append(" AND (n.published_at, n.id) < (:afterAt, :afterId)");
			all.put("afterAt", after.publishedAt());
			all.put("afterId", after.id());
		}
		sql.append(" ORDER BY n.published_at DESC, n.id DESC LIMIT :limit");
		all.put("limit", limit);
		return jdbc.sql(sql.toString()).params(all).query((rs, i) -> summary(rs)).list();
	}

	public long count(String where, Map<String, ?> params) {
		String sql = "SELECT count(*) FROM news n JOIN categories c ON c.id = n.category_id WHERE "
				+ PUBLIC + (where == null ? "" : " AND (" + where + ")");
		return jdbc.sql(sql).params(params).query(Long.class).single();
	}

	/** Lista simples ordenada (destaques, vídeos, mais lidas). */
	public List<NewsSummary> list(String where, String orderBy, Map<String, ?> params, int limit,
			String extraJoin) {
		String sql = SUMMARY_SELECT + (extraJoin == null ? "" : extraJoin) + " WHERE " + PUBLIC
				+ (where == null ? "" : " AND (" + where + ")") + " ORDER BY " + orderBy + " LIMIT :limit";
		var all = new HashMap<String, Object>(params);
		all.put("limit", limit);
		return jdbc.sql(sql).params(all).query((rs, i) -> summary(rs)).list();
	}

	public Optional<Detail> detail(String slug) {
		String sql = SUMMARY_SELECT.replace("SELECT n.id,", """
				SELECT n.body::text AS body, n.video::text AS video, n.sponsor_name, n.sponsor_url,
				       n.reading_time_minutes, n.origin, n.seo_title, n.seo_description,
				       n.canonical_url, n.category_id, n.id,""")
				+ " WHERE " + PUBLIC + " AND n.slug = :slug";
		return jdbc.sql(sql).param("slug", slug).query((rs, i) -> {
			String sponsorName = rs.getString("sponsor_name");
			String seoTitle = rs.getString("seo_title");
			String seoDescription = rs.getString("seo_description");
			String canonical = rs.getString("canonical_url");
			return new Detail(summary(rs), rs.getObject("category_id", UUID.class), rs.getString("body"),
					rs.getString("video"),
					sponsorName == null ? null : new Sponsor(sponsorName, rs.getString("sponsor_url")),
					rs.getInt("reading_time_minutes"), rs.getString("origin"),
					seoTitle == null && seoDescription == null && canonical == null ? null
							: new NewsSeo(seoTitle, seoDescription, canonical));
		}).optional();
	}

	/** Autores por notícia, na ordem do crédito. */
	public Map<UUID, List<Author>> authorsOf(Collection<UUID> newsIds) {
		Map<UUID, List<Author>> byNews = new LinkedHashMap<>();
		if (newsIds.isEmpty()) {
			return byNews;
		}
		jdbc.sql("""
				SELECT na.news_id, a.* FROM news_authors na JOIN authors a ON a.id = na.author_id
				WHERE na.news_id IN (:ids) ORDER BY na.position""")
			.param("ids", newsIds)
			.query((ResultSet rs) -> {
				byNews.computeIfAbsent(rs.getObject("news_id", UUID.class), k -> new ArrayList<>())
					.add(TaxonomyReadRepository.author(rs, ""));
			});
		return byNews;
	}

	public Map<UUID, List<Tag>> tagsOf(Collection<UUID> newsIds) {
		Map<UUID, List<Tag>> byNews = new LinkedHashMap<>();
		if (newsIds.isEmpty()) {
			return byNews;
		}
		jdbc.sql("""
				SELECT nt.news_id, t.id, t.slug, t.name FROM news_tags nt JOIN tags t ON t.id = nt.tag_id
				WHERE nt.news_id IN (:ids) ORDER BY t.name""")
			.param("ids", newsIds)
			.query((ResultSet rs) -> {
				byNews.computeIfAbsent(rs.getObject("news_id", UUID.class), k -> new ArrayList<>())
					.add(TaxonomyReadRepository.tag(rs));
			});
		return byNews;
	}

	/** Busca textual ranqueada (BE-005), com deslocamento (relevância não tem keyset estável). */
	public List<NewsSummary> search(String where, Map<String, ?> params, int offset, int limit) {
		String sql = SUMMARY_SELECT + " WHERE " + PUBLIC + " AND (" + where + ")"
				+ " ORDER BY ts_rank(n.search_vector, websearch_to_tsquery('portuguese', f_unaccent(:q))) DESC,"
				+ " word_similarity(f_unaccent(:q), f_unaccent(n.title)) DESC, n.published_at DESC"
				+ " LIMIT :limit OFFSET :offset";
		var all = new HashMap<String, Object>(params);
		all.put("limit", limit);
		all.put("offset", offset);
		return jdbc.sql(sql).params(all).query((rs, i) -> summary(rs)).list();
	}

	/** Endereço antigo que redireciona (editoria/notícia mudou de slug). */
	public Optional<String> redirectFor(String path) {
		return jdbc.sql("SELECT new_path FROM path_redirects WHERE old_path = :path")
			.param("path", path)
			.query(String.class)
			.optional();
	}

	// ---------------------------------------------------------------- mapeamento

	public static NewsSummary summary(ResultSet rs) throws SQLException {
		UUID cityId = rs.getObject("ci_id", UUID.class);
		UUID neighborhoodId = rs.getObject("nb_id", UUID.class);
		NewsLocation location = cityId == null ? null
				: new NewsLocation(
						new City(cityId, rs.getString("ci_slug"), rs.getString("ci_name"), rs.getString("ci_state")),
						neighborhoodId == null ? null : TaxonomyReadRepository.neighborhood(rs));
		UUID imageId = rs.getObject("m_id", UUID.class);
		MediaAsset image = imageId == null ? null
				: new MediaAsset(imageId, rs.getString("m_url"), rs.getInt("m_width"), rs.getInt("m_height"),
						rs.getString("m_alt"), rs.getString("m_caption"), rs.getString("m_credit"));
		OffsetDateTime published = rs.getObject("published_at", OffsetDateTime.class);
		OffsetDateTime updated = rs.getObject("updated_at", OffsetDateTime.class);
		return new NewsSummary(rs.getObject("id", UUID.class), rs.getString("slug"), rs.getString("title"),
				rs.getString("subtitle"), rs.getString("summary"), TaxonomyReadRepository.category(rs), location,
				image, rs.getBoolean("has_video"), rs.getBoolean("is_urgent"), rs.getBoolean("is_sponsored"),
				published,
				// Só informa a atualização quando ela é posterior à publicação.
				updated != null && published != null && updated.isAfter(published.plusMinutes(1)) ? updated : null);
	}

}
