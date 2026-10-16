package br.com.zonasulurgente.api.taxonomy.admin;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.InvalidFieldsException;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import br.com.zonasulurgente.api.site.SiteRefresh;

/**
 * Gestão de editorias (FE-158). Mesmas regras de src/lib/taxonomy/validate.ts: um nível de
 * subeditoria, endereço livre de rotas fixas, cor obrigatória na principal, até 8 na barra.
 * Trocar o endereço registra o redirecionamento do antigo (vale para tudo que fica abaixo).
 * Toda operação devolve a lista inteira atualizada (a tela troca a dela pela da API).
 */
@Service
public class CategoryAdminService {

	static final int NAME_MAX = 40;
	static final int SLUG_MAX = 40;
	static final int DESCRIPTION_MAX = 160;
	static final int BAR_MAX = 8;
	private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
	private static final Pattern WHATSAPP = Pattern
		.compile("^https://(whatsapp\\.com/channel|chat\\.whatsapp\\.com)/[\\w-]+.*");
	private static final Set<String> COLORS = Set.of("seguranca", "transito", "cidade", "politica", "economia",
			"esportes", "entretenimento", "comunidade", "classificados");

	private record Row(UUID id, String slug, UUID parentId, String parentSlug, boolean inBar, boolean active,
			int order) {
	}

	private final JdbcClient jdbc;
	private final SiteRefresh site;

	CategoryAdminService(JdbcClient jdbc, SiteRefresh site) {
		this.jdbc = jdbc;
		this.site = site;
	}

	@Transactional(readOnly = true)
	public List<AdminCategory> list() {
		return jdbc.sql("""
				SELECT c.id, c.name, c.slug, p.slug AS parent_slug, c.color, c.in_bar, c.active, c.sort_order,
				       c.whatsapp_url, c.description,
				       (SELECT count(*) FROM news n JOIN categories nc ON nc.id = n.category_id
				        WHERE n.deleted_at IS NULL AND (nc.id = c.id OR nc.parent_id = c.id)) AS news_count
				FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
				ORDER BY c.sort_order, c.name""")
			.query((rs, i) -> new AdminCategory(rs.getObject("id", UUID.class), rs.getString("name"),
					rs.getString("slug"), rs.getString("parent_slug"), rs.getString("color"), rs.getBoolean("in_bar"),
					rs.getBoolean("active"), rs.getInt("sort_order"), rs.getString("whatsapp_url"),
					rs.getString("description"), rs.getLong("news_count")))
			.list();
	}

	@Transactional
	public List<AdminCategory> create(AdminCategory.Input input) {
		List<Row> all = rows();
		Map<String, String> errors = validate(input, null, all);
		if (!errors.isEmpty()) {
			throw new InvalidFieldsException(errors);
		}
		Row parent = parentOf(input, all);
		int order = all.stream()
			.filter(r -> parent == null ? r.parentId() == null : parent.id().equals(r.parentId()))
			.mapToInt(Row::order)
			.max()
			.orElse(0) + 10;
		jdbc.sql("""
				INSERT INTO categories (slug, name, description, parent_id, color, in_bar, sort_order, whatsapp_url)
				VALUES (:slug, :name, :description, :parent, :color, :inBar, :order, :whatsapp)""")
			.params(fields(input, parent))
			.param("order", order)
			.update();
		// Endereço novo que já foi de outra editoria: deixa de redirecionar.
		jdbc.sql("DELETE FROM path_redirects WHERE old_path = :path").param("path", path(input.slug(), parent)).update();
		site.taxonomy();
		return list();
	}

	@Transactional
	public List<AdminCategory> update(UUID id, AdminCategory.Input input) {
		List<Row> all = rows();
		Row before = all.stream().filter(r -> r.id().equals(id)).findFirst()
			.orElseThrow(() -> new NotFoundException("Editoria não encontrada."));
		Map<String, String> errors = validate(input, before, all);
		if (!errors.isEmpty()) {
			throw new InvalidFieldsException(errors);
		}
		Row parent = parentOf(input, all);
		String oldPath = path(before.slug(), before.parentSlug());
		String newPath = path(input.slug(), parent);
		String oldSlug = before.slug();
		jdbc.sql("""
				UPDATE categories SET slug = :slug, name = :name, description = :description, parent_id = :parent,
				  color = :color, in_bar = :inBar, whatsapp_url = :whatsapp, updated_at = now() WHERE id = :id""")
			.params(fields(input, parent))
			.param("id", id)
			.update();
		if (!oldPath.equals(newPath)) {
			redirect(oldPath, newPath);
		}
		// Nome, cor e endereço aparecem nas páginas das matérias (selo, migalhas, links).
		site.publishedNews("n.category_id IN (SELECT id FROM categories WHERE id = :id OR parent_id = :id)",
				Map.of("id", id), "category:" + oldSlug, "category:" + input.slug().strip());
		return list();
	}

	/** Sobe/desce entre as irmãs (menu do site). */
	@Transactional
	public List<AdminCategory> move(UUID id, int direction) {
		List<Row> all = rows();
		Row item = all.stream().filter(r -> r.id().equals(id)).findFirst()
			.orElseThrow(() -> new NotFoundException("Editoria não encontrada."));
		List<Row> siblings = new ArrayList<>(all.stream()
			.filter(r -> item.parentId() == null ? r.parentId() == null : item.parentId().equals(r.parentId()))
			.toList());
		int index = siblings.indexOf(item);
		int target = index + Integer.signum(direction);
		if (target < 0 || target >= siblings.size()) {
			return list();
		}
		siblings.set(index, siblings.get(target));
		siblings.set(target, item);
		for (int i = 0; i < siblings.size(); i++) {
			jdbc.sql("UPDATE categories SET sort_order = :order WHERE id = :id")
				.param("order", (i + 1) * 10)
				.param("id", siblings.get(i).id())
				.update();
		}
		site.taxonomy();
		return list();
	}

	/** Desativar tira do menu e do editor (com as subeditorias); as matérias seguem no ar. */
	@Transactional
	public List<AdminCategory> setActive(UUID id, boolean active) {
		List<Row> all = rows();
		Row item = all.stream().filter(r -> r.id().equals(id)).findFirst()
			.orElseThrow(() -> new NotFoundException("Editoria não encontrada."));
		if (active && item.parentId() == null && item.inBar()
				&& all.stream().filter(r -> r.parentId() == null && r.inBar() && r.active()).count() >= BAR_MAX) {
			throw new ApiException(HttpStatus.CONFLICT, "Barra cheia",
					"A barra comporta até " + BAR_MAX + " editorias; tire uma antes de reativar esta.");
		}
		jdbc.sql("UPDATE categories SET active = :active, updated_at = now() WHERE id = :id"
				+ (active ? "" : " OR parent_id = :id"))
			.param("active", active)
			.param("id", id)
			.update();
		site.taxonomy("category:" + item.slug());
		return list();
	}

	/** Só sem matérias e sem subeditorias (com matérias, desative). */
	@Transactional
	public List<AdminCategory> delete(UUID id) {
		Row item = rows().stream().filter(r -> r.id().equals(id)).findFirst()
			.orElseThrow(() -> new NotFoundException("Editoria não encontrada."));
		boolean used = jdbc.sql("""
				SELECT EXISTS (SELECT 1 FROM news n JOIN categories c ON c.id = n.category_id
				               WHERE c.id = :id OR c.parent_id = :id)
				    OR EXISTS (SELECT 1 FROM categories WHERE parent_id = :id)""")
			.param("id", id)
			.query(Boolean.class)
			.single();
		if (used) {
			throw new ApiException(HttpStatus.CONFLICT, "Editoria em uso",
					"Só dá para excluir editoria sem matérias e sem subeditorias. Desative em vez de excluir.");
		}
		jdbc.sql("DELETE FROM categories WHERE id = :id").param("id", id).update();
		site.taxonomy("category:" + item.slug());
		return list();
	}

	// ---------------------------------------------------------------- regras

	Map<String, String> validate(AdminCategory.Input in, Row before, List<Row> all) {
		Map<String, String> e = new LinkedHashMap<>();
		List<Row> others = all.stream().filter(r -> before == null || !r.id().equals(before.id())).toList();
		String name = trim(in.name());
		String slug = trim(in.slug());
		String parentSlug = trim(in.parentSlug());
		if (name.length() < 2) {
			e.put("name", "Dê um nome (2+ letras).");
		}
		else if (name.length() > NAME_MAX) {
			e.put("name", "No máximo " + NAME_MAX + " caracteres.");
		}

		if (!SLUG.matcher(slug).matches()) {
			e.put("slug", "Use só letras minúsculas, números e hífen (ex.: meio-ambiente).");
		}
		else if (slug.length() > SLUG_MAX) {
			e.put("slug", "No máximo " + SLUG_MAX + " caracteres.");
		}
		else if (parentSlug.isEmpty() && ReservedSlugs.ALL.contains(slug)) {
			e.put("slug", "“/" + slug + "” é usado por uma página fixa do site.");
		}
		else if (others.stream().anyMatch(r -> r.slug().equals(slug))) {
			e.put("slug", "Já existe uma editoria com esse endereço.");
		}

		if (!parentSlug.isEmpty()) {
			Optional<Row> parent = others.stream().filter(r -> r.slug().equals(parentSlug)).findFirst();
			if (parent.isEmpty() || parent.get().parentId() != null) {
				e.put("parentSlug", "A editoria mãe precisa ser uma editoria principal.");
			}
			else if (before != null && others.stream().anyMatch(r -> before.id().equals(r.parentId()))) {
				e.put("parentSlug", "Esta editoria tem subeditorias; ela não pode virar subeditoria.");
			}
		}
		else if (trim(in.color()).isEmpty() || !COLORS.contains(in.color())) {
			e.put("color", "Escolha a cor da editoria.");
		}

		if (in.inBar() && parentSlug.isEmpty()
				&& others.stream().filter(r -> r.parentId() == null && r.inBar() && r.active()).count() >= BAR_MAX) {
			e.put("inBar", "A barra comporta até " + BAR_MAX + " editorias; tire uma antes.");
		}
		if (!trim(in.whatsappUrl()).isEmpty() && !WHATSAPP.matcher(trim(in.whatsappUrl())).matches()) {
			e.put("whatsappUrl", "Use o link do canal (https://whatsapp.com/channel/...).");
		}
		if (trim(in.description()).length() > DESCRIPTION_MAX) {
			e.put("description", "No máximo " + DESCRIPTION_MAX + " caracteres.");
		}
		return e;
	}

	// ---------------------------------------------------------------- internos

	private List<Row> rows() {
		return jdbc.sql("""
				SELECT c.id, c.slug, c.parent_id, p.slug AS parent_slug, c.in_bar, c.active, c.sort_order
				FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
				ORDER BY c.sort_order, c.name FOR UPDATE OF c""")
			.query((rs, i) -> new Row(rs.getObject("id", UUID.class), rs.getString("slug"),
					rs.getObject("parent_id", UUID.class), rs.getString("parent_slug"), rs.getBoolean("in_bar"),
					rs.getBoolean("active"), rs.getInt("sort_order")))
			.list();
	}

	private static Row parentOf(AdminCategory.Input in, List<Row> all) {
		String parentSlug = trim(in.parentSlug());
		return parentSlug.isEmpty() ? null
				: all.stream().filter(r -> r.slug().equals(parentSlug)).findFirst().orElseThrow();
	}

	private static Map<String, Object> fields(AdminCategory.Input in, Row parent) {
		Map<String, Object> p = new java.util.HashMap<>();
		p.put("slug", trim(in.slug()));
		p.put("name", trim(in.name()));
		p.put("description", blankToNull(in.description()));
		p.put("parent", parent == null ? null : parent.id());
		// Subeditoria herda a cor e nunca vai para a barra.
		p.put("color", parent == null ? trim(in.color()) : null);
		p.put("inBar", parent == null && in.inBar());
		p.put("whatsapp", blankToNull(in.whatsappUrl()));
		return p;
	}

	/**
	 * Endereço antigo → novo. Redirecionamentos que já apontavam para o antigo passam a
	 * apontar para o novo (sem cadeia), e o novo deixa de ser "antigo" se a editoria voltou a ele.
	 */
	private void redirect(String oldPath, String newPath) {
		jdbc.sql("DELETE FROM path_redirects WHERE old_path = :new").param("new", newPath).update();
		jdbc.sql("""
				DELETE FROM path_redirects
				WHERE (new_path = :old OR new_path LIKE :old || '/%')
				  AND old_path = :new || substr(new_path, length(:old) + 1)""")
			.param("old", oldPath).param("new", newPath).update();
		jdbc.sql("""
				UPDATE path_redirects SET new_path = :new || substr(new_path, length(:old) + 1)
				WHERE new_path = :old OR new_path LIKE :old || '/%'""")
			.param("old", oldPath).param("new", newPath).update();
		jdbc.sql("""
				INSERT INTO path_redirects (old_path, new_path) VALUES (:old, :new)
				ON CONFLICT (old_path) DO UPDATE SET new_path = excluded.new_path""")
			.param("old", oldPath).param("new", newPath).update();
	}

	private static String path(String slug, Row parent) {
		return path(trim(slug), parent == null ? null : parent.slug());
	}

	private static String path(String slug, String parentSlug) {
		return parentSlug == null ? "/" + slug : "/" + parentSlug + "/" + slug;
	}

	static String trim(String value) {
		return value == null ? "" : value.strip();
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

}
