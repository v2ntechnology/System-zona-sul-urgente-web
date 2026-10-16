package br.com.zonasulurgente.api.taxonomy.infrastructure;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import br.com.zonasulurgente.api.shared.contract.Author;
import br.com.zonasulurgente.api.shared.contract.Category;
import br.com.zonasulurgente.api.shared.contract.CategoryRef;
import br.com.zonasulurgente.api.shared.contract.City;
import br.com.zonasulurgente.api.shared.contract.Columnist;
import br.com.zonasulurgente.api.shared.contract.Neighborhood;
import br.com.zonasulurgente.api.shared.contract.Tag;
import br.com.zonasulurgente.api.shared.contract.Zone;

/** Leitura pública de taxonomia (editorias, bairros, autores, tópicos) — BE-004. */
@Repository
public class TaxonomyReadRepository {

	/** Colunas de uma editoria (prefixo c_), da mãe (p_) e do colunista (ca_), para os SELECTs. */
	public static final String CATEGORY_COLUMNS = """
			c.id AS c_id, c.slug AS c_slug, c.name AS c_name, c.description AS c_description,
			coalesce(c.whatsapp_url, p.whatsapp_url) AS c_whatsapp, c.sort_order AS c_order,
			c.in_bar AS c_in_bar, c.active AS c_active, c.color AS c_color,
			p.id AS p_id, p.slug AS p_slug, p.name AS p_name,
			ca.slug AS ca_slug, ca.name AS ca_name, ca.bio AS ca_bio""";

	public static final String CATEGORY_JOINS = """
			LEFT JOIN categories p ON p.id = c.parent_id
			LEFT JOIN authors ca ON ca.id = c.columnist_id""";

	private static final String CATEGORY_SELECT = "SELECT " + CATEGORY_COLUMNS
			+ " FROM categories c " + CATEGORY_JOINS;

	private static final String NEIGHBORHOOD_SELECT = """
			SELECT nb.id AS nb_id, nb.slug AS nb_slug, nb.name AS nb_name,
			       z.id AS z_id, z.slug AS z_slug, z.name AS z_name, zc.slug AS nb_city_slug
			FROM neighborhoods nb
			JOIN zones z ON z.id = nb.zone_id
			JOIN cities zc ON zc.id = z.city_id""";

	private final JdbcClient jdbc;

	public TaxonomyReadRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Todas as editorias (inclusive desativadas: as matérias delas continuam no ar). */
	public List<Category> categories() {
		return jdbc.sql(CATEGORY_SELECT + " ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.name")
			.query((rs, i) -> category(rs))
			.list();
	}

	public Optional<Category> category(String slug) {
		return jdbc.sql(CATEGORY_SELECT + " WHERE c.slug = :slug")
			.param("slug", slug)
			.query((rs, i) -> category(rs))
			.optional();
	}

	public List<Neighborhood> neighborhoods() {
		return jdbc.sql(NEIGHBORHOOD_SELECT + " ORDER BY nb.name")
			.query((rs, i) -> neighborhood(rs))
			.list();
	}

	public Optional<Neighborhood> neighborhood(String slug) {
		return jdbc.sql(NEIGHBORHOOD_SELECT + " WHERE nb.slug = :slug")
			.param("slug", slug)
			.query((rs, i) -> neighborhood(rs))
			.optional();
	}

	public Optional<City> city(String slug) {
		return jdbc.sql("SELECT id, slug, name, state FROM cities WHERE slug = :slug")
			.param("slug", slug)
			.query((rs, i) -> new City(rs.getObject("id", UUID.class), rs.getString("slug"),
					rs.getString("name"), rs.getString("state")))
			.optional();
	}

	public List<Author> authors() {
		return jdbc.sql("SELECT * FROM authors ORDER BY name")
			.query((rs, i) -> author(rs, ""))
			.list();
	}

	public List<Tag> tags() {
		return jdbc.sql("SELECT id, slug, name FROM tags WHERE active ORDER BY name")
			.query((rs, i) -> tag(rs))
			.list();
	}

	/** Tópicos mais usados nas notícias publicadas dos últimos 7 dias. */
	public List<Tag> popularTags(int limit) {
		return jdbc.sql("""
				SELECT t.id, t.slug, t.name, count(*) AS uses
				FROM tags t
				JOIN news_tags nt ON nt.tag_id = t.id
				JOIN news n ON n.id = nt.news_id
				WHERE t.active AND n.status = 'PUBLISHED' AND n.deleted_at IS NULL
				  AND n.published_at > now() - interval '7 days'
				GROUP BY t.id
				ORDER BY uses DESC, t.name
				LIMIT :limit""")
			.param("limit", limit)
			.query((rs, i) -> tag(rs))
			.list();
	}

	// ---------------------------------------------------------------- mapeamento

	public static Category category(ResultSet rs) throws SQLException {
		UUID parentId = rs.getObject("p_id", UUID.class);
		String columnistSlug = rs.getString("ca_slug");
		return new Category(rs.getObject("c_id", UUID.class), rs.getString("c_slug"),
				rs.getString("c_name"), rs.getString("c_description"),
				parentId == null ? null : new CategoryRef(parentId, rs.getString("p_slug"), rs.getString("p_name")),
				rs.getString("c_whatsapp"),
				columnistSlug == null ? null
						: new Columnist(columnistSlug, rs.getString("ca_name"), rs.getString("ca_bio")),
				rs.getInt("c_order"), rs.getBoolean("c_in_bar"), rs.getBoolean("c_active"),
				rs.getString("c_color"));
	}

	public static Neighborhood neighborhood(ResultSet rs) throws SQLException {
		return new Neighborhood(rs.getObject("nb_id", UUID.class), rs.getString("nb_slug"),
				rs.getString("nb_name"), rs.getString("nb_city_slug"),
				new Zone(rs.getObject("z_id", UUID.class), rs.getString("z_slug"), rs.getString("z_name")));
	}

	public static Author author(ResultSet rs, String prefix) throws SQLException {
		return new Author(rs.getObject(prefix + "id", UUID.class), rs.getString(prefix + "slug"),
				rs.getString(prefix + "name"), rs.getString(prefix + "role"), rs.getString(prefix + "bio"),
				rs.getBoolean(prefix + "active"), rs.getString(prefix + "instagram"));
	}

	public static Tag tag(ResultSet rs) throws SQLException {
		return new Tag(rs.getObject("id", UUID.class), rs.getString("slug"), rs.getString("name"));
	}

}
