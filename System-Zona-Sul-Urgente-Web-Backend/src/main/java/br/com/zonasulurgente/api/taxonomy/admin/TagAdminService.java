package br.com.zonasulurgente.api.taxonomy.admin;

import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.news.admin.TagKeys;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.InvalidFieldsException;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import br.com.zonasulurgente.api.site.SiteRefresh;

/**
 * Tópicos (FE-158): renomear, desativar e juntar duplicados. O endereço (slug) não muda ao
 * renomear — o site não tem página de tópico, e o editor guarda os tópicos pelo slug.
 * Juntar passa as matérias para o tópico que fica e apaga os outros.
 */
@Service
public class TagAdminService {

	static final int NAME_MIN = 2;
	static final int NAME_MAX = 40;

	private final JdbcClient jdbc;
	private final SiteRefresh site;

	TagAdminService(JdbcClient jdbc, SiteRefresh site) {
		this.jdbc = jdbc;
		this.site = site;
	}

	@Transactional(readOnly = true)
	public List<AdminTag> list() {
		return jdbc.sql("""
				SELECT t.id, t.slug, t.name, t.active, count(n.id) AS news_count, max(n.published_at) AS last_used
				FROM tags t
				LEFT JOIN news_tags nt ON nt.tag_id = t.id
				LEFT JOIN news n ON n.id = nt.news_id AND n.deleted_at IS NULL
				GROUP BY t.id
				ORDER BY count(n.id) DESC, t.name""")
			.query((rs, i) -> new AdminTag(rs.getObject("id", UUID.class), rs.getString("slug"), rs.getString("name"),
					rs.getBoolean("active"), rs.getLong("news_count"), rs.getObject("last_used", OffsetDateTime.class)))
			.list();
	}

	@Transactional
	public List<AdminTag> rename(UUID id, String name) {
		requireTag(id);
		String clean = name == null ? "" : name.strip().replaceAll("^#+", "").replaceAll("\\s+", " ");
		String error = null;
		if (clean.length() < NAME_MIN) {
			error = "Tópico precisa de pelo menos " + NAME_MIN + " letras.";
		}
		else if (clean.length() > NAME_MAX) {
			error = "Tópico com no máximo " + NAME_MAX + " caracteres.";
		}
		else if (TagKeys.slug(clean).isEmpty()) {
			error = "Use letras ou números no nome do tópico.";
		}
		else {
			String key = TagKeys.key(clean);
			error = jdbc.sql("SELECT name FROM tags WHERE id <> :id").param("id", id).query(String.class).list()
				.stream()
				.filter(other -> TagKeys.key(other).equals(key))
				.findFirst()
				.map(other -> "Já existe “" + other + "”. Para unir os dois, use “Juntar”.")
				.orElse(null);
		}
		if (error != null) {
			throw new InvalidFieldsException(Map.of("name", error));
		}
		jdbc.sql("UPDATE tags SET name = :name WHERE id = :id").param("name", clean).param("id", id).update();
		site.publishedNews("n.id IN (SELECT news_id FROM news_tags WHERE tag_id = :id)", Map.of("id", id));
		return list();
	}

	/** Desativado some do editor; as matérias continuam com ele. */
	@Transactional
	public List<AdminTag> setActive(UUID id, boolean active) {
		requireTag(id);
		jdbc.sql("UPDATE tags SET active = :active WHERE id = :id").param("active", active).param("id", id).update();
		site.taxonomy();
		return list();
	}

	@Transactional
	public List<AdminTag> merge(UUID keepId, List<UUID> mergeIds) {
		Set<UUID> merged = new LinkedHashSet<>(mergeIds == null ? List.of() : mergeIds);
		merged.remove(keepId);
		if (merged.isEmpty()) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "Nada para juntar",
					"Escolha pelo menos dois tópicos para juntar.");
		}
		requireTag(keepId);
		long found = jdbc.sql("SELECT count(*) FROM tags WHERE id IN (:ids)").param("ids", merged).query(Long.class)
			.single();
		if (found != merged.size()) {
			throw new NotFoundException("Tópico não encontrado.");
		}
		// Antes de mexer: as matérias afetadas (para avisar o site).
		site.publishedNews("n.id IN (SELECT news_id FROM news_tags WHERE tag_id IN (:ids))", Map.of("ids", merged));
		jdbc.sql("""
				INSERT INTO news_tags (news_id, tag_id)
				SELECT news_id, :keep FROM news_tags WHERE tag_id IN (:ids)
				ON CONFLICT DO NOTHING""")
			.param("keep", keepId)
			.param("ids", merged)
			.update();
		jdbc.sql("DELETE FROM news_tags WHERE tag_id IN (:ids)").param("ids", merged).update();
		jdbc.sql("DELETE FROM tags WHERE id IN (:ids)").param("ids", merged).update();
		return list();
	}

	private void requireTag(UUID id) {
		if (!jdbc.sql("SELECT EXISTS (SELECT 1 FROM tags WHERE id = :id)").param("id", id).query(Boolean.class)
			.single()) {
			throw new NotFoundException("Tópico não encontrado.");
		}
	}

}
