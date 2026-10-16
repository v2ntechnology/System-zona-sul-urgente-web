package br.com.zonasulurgente.api.team;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.news.admin.TagKeys;
import br.com.zonasulurgente.api.shared.web.InvalidFieldsException;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import br.com.zonasulurgente.api.site.SiteRefresh;

/**
 * Autores (FE-159): os da equipe nascem com o convite; aqui entram também os sem login
 * (colaborador, agência, "Redação"). Desativar tira do editor, mas o autor segue assinando
 * as matérias antigas. O endereço (/autor/{slug}) nasce do nome e não muda depois.
 */
@Service
public class AuthorService {

	static final int NAME_MIN = 2;
	static final int NAME_MAX = 120;
	static final int ROLE_MAX = 60;
	static final int BIO_MAX = 160;
	private static final Pattern INSTAGRAM = Pattern.compile("^@?[\\w.]{1,30}$");

	private final JdbcClient jdbc;
	private final SiteRefresh site;

	AuthorService(JdbcClient jdbc, SiteRefresh site) {
		this.jdbc = jdbc;
		this.site = site;
	}

	@Transactional(readOnly = true)
	public List<AuthorProfile> list() {
		return jdbc.sql("""
				SELECT a.id, a.slug, a.name, a.role, a.bio, m.url AS photo, a.instagram, a.active,
				       (SELECT count(*) FROM news_authors na JOIN news n ON n.id = na.news_id
				        WHERE na.author_id = a.id AND n.deleted_at IS NULL) AS news_count,
				       u.id AS user_id, u.name AS user_name
				FROM authors a
				LEFT JOIN media_assets m ON m.id = a.avatar_id
				LEFT JOIN users u ON u.author_id = a.id
				ORDER BY a.active DESC, news_count DESC, a.name""")
			.query((rs, i) -> new AuthorProfile(rs.getObject("id", UUID.class), rs.getString("slug"),
					rs.getString("name"), rs.getString("role"), rs.getString("bio") == null ? "" : rs.getString("bio"),
					rs.getString("photo"), rs.getString("instagram"), rs.getBoolean("active"), rs.getLong("news_count"),
					rs.getObject("user_id") == null ? null
							: new AuthorProfile.Member(rs.getObject("user_id", UUID.class), rs.getString("user_name"))))
			.list();
	}

	@Transactional
	public List<AuthorProfile> create(AuthorProfile.Input input) {
		validate(input);
		insert(input.name().strip(), input.role().strip(), input.bio(), input.instagram());
		site.taxonomy();
		return list();
	}

	/** Cria o autor e devolve o id (convite da equipe com "criar autor"). */
	@Transactional
	public UUID insert(String name, String role, String bio, String instagram) {
		return jdbc.sql("""
				INSERT INTO authors (slug, name, role, bio, instagram) VALUES (:slug, :name, :role, :bio, :instagram)
				RETURNING id""")
			.param("slug", uniqueSlug(name))
			.param("name", name)
			.param("role", role)
			.param("bio", blankToNull(bio))
			.param("instagram", instagram(instagram))
			.query(UUID.class)
			.single();
	}

	@Transactional
	public List<AuthorProfile> update(UUID id, AuthorProfile.Input input) {
		requireAuthor(id);
		validate(input);
		jdbc.sql("UPDATE authors SET name = :name, role = :role, bio = :bio, instagram = :instagram WHERE id = :id")
			.param("name", input.name().strip())
			.param("role", input.role().strip())
			.param("bio", blankToNull(input.bio()))
			.param("instagram", instagram(input.instagram()))
			.param("id", id)
			.update();
		// A assinatura aparece nas matérias.
		site.publishedNews("n.id IN (SELECT news_id FROM news_authors WHERE author_id = :id)", Map.of("id", id));
		return list();
	}

	@Transactional
	public List<AuthorProfile> setActive(UUID id, boolean active) {
		requireAuthor(id);
		jdbc.sql("UPDATE authors SET active = :active WHERE id = :id").param("active", active).param("id", id).update();
		site.taxonomy();
		return list();
	}

	private void validate(AuthorProfile.Input in) {
		Map<String, String> e = new LinkedHashMap<>();
		String name = in.name() == null ? "" : in.name().strip();
		if (name.length() < NAME_MIN || name.length() > NAME_MAX) {
			e.put("name", "Informe o nome como vai aparecer na assinatura.");
		}
		String role = in.role() == null ? "" : in.role().strip();
		if (role.isEmpty()) {
			e.put("role", "Informe o cargo (ex.: Colaborador).");
		}
		else if (role.length() > ROLE_MAX) {
			e.put("role", "No máximo " + ROLE_MAX + " caracteres.");
		}
		if (in.bio() != null && in.bio().strip().length() > BIO_MAX) {
			e.put("bio", "No máximo " + BIO_MAX + " caracteres.");
		}
		if (in.instagram() != null && !in.instagram().isBlank() && !INSTAGRAM.matcher(in.instagram().strip()).matches()) {
			e.put("instagram", "Use só o usuário (ex.: @zonasulurgente).");
		}
		if (!e.isEmpty()) {
			throw new InvalidFieldsException(e);
		}
	}

	private String uniqueSlug(String name) {
		String base = TagKeys.slug(name);
		if (base.length() > 70) {
			base = base.substring(0, 70).replaceAll("-+$", "");
		}
		if (base.isEmpty()) {
			base = "autor";
		}
		String slug = base;
		for (int i = 2; jdbc.sql("SELECT EXISTS (SELECT 1 FROM authors WHERE slug = :s)").param("s", slug)
			.query(Boolean.class).single(); i++) {
			slug = base + "-" + i;
		}
		return slug;
	}

	private void requireAuthor(UUID id) {
		if (!jdbc.sql("SELECT EXISTS (SELECT 1 FROM authors WHERE id = :id)").param("id", id).query(Boolean.class)
			.single()) {
			throw new NotFoundException("Autor não encontrado.");
		}
	}

	private static String instagram(String value) {
		return value == null || value.isBlank() ? null : value.strip().replaceFirst("^@", "");
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

}
