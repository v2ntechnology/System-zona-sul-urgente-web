package br.com.zonasulurgente.api.taxonomy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.TestSessions;
import br.com.zonasulurgente.api.TestcontainersConfiguration;

/** FE-158 na API: editorias (com redirecionamento do endereço antigo) e tópicos. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class TaxonomyAdminApiTests {

	static final String EDITOR = "rafael.duarte@zonasulurgente.com.br";
	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	private String id(String table, String slug) {
		return jdbc.sql("SELECT id::text FROM " + table + " WHERE slug = :s").param("s", slug).query(String.class)
			.single();
	}

	private ResultActions send(String method, String path, String auth, String json) throws Exception {
		var request = switch (method) {
			case "POST" -> post(path);
			case "PUT" -> put(path);
			case "DELETE" -> delete(path);
			default -> get(path);
		};
		request.header("Authorization", auth);
		if (json != null) {
			request.contentType(MediaType.APPLICATION_JSON).content(json);
		}
		return mvc.perform(request);
	}

	private static String category(String name, String slug, String parent, String color, boolean inBar) {
		return """
				{"name":"%s","slug":"%s","parentSlug":"%s","color":"%s","inBar":%s,"whatsappUrl":"","description":""}"""
			.formatted(name, slug, parent, color, inBar);
	}

	@Test
	void renamingACategoryRedirectsItsOldAddressAndEverythingBelowIt() throws Exception {
		String auth = TestSessions.bearer(jdbc, EDITOR);
		String newsSlug = jdbc.sql("""
				SELECT n.slug FROM news n JOIN categories c ON c.id = n.category_id
				WHERE c.slug = 'esportes' AND n.status = 'PUBLISHED' LIMIT 1""").query(String.class).single();
		jdbc.sql("DELETE FROM job_queue").update();

		send("PUT", "/api/v1/admin/categories/" + id("categories", "esportes"), auth,
				category("Esporte", "esporte", "", "esportes", true))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.slug == 'esporte')].name").value(hasItem("Esporte")));

		mvc.perform(get("/api/v1/public/resolve").param("path", "esportes"))
			.andExpect(jsonPath("$.type").value("redirect"))
			.andExpect(jsonPath("$.location").value("/esporte"));
		mvc.perform(get("/api/v1/public/resolve").param("path", "esportes/" + newsSlug))
			.andExpect(jsonPath("$.type").value("redirect"))
			.andExpect(jsonPath("$.location").value("/esporte/" + newsSlug));
		mvc.perform(get("/api/v1/public/resolve").param("path", "esporte/" + newsSlug))
			.andExpect(jsonPath("$.type").value("news"));

		// Voltar ao endereço antigo não cria laço: o redirecionamento some.
		send("PUT", "/api/v1/admin/categories/" + id("categories", "esporte"), auth,
				category("Esportes", "esportes", "", "esportes", true))
			.andExpect(status().isOk());
		mvc.perform(get("/api/v1/public/resolve").param("path", "esportes"))
			.andExpect(jsonPath("$.type").value("category"));
		assertThat(jdbc.sql("SELECT count(*) FROM path_redirects WHERE old_path LIKE '/esporte%'").query(Long.class)
			.single()).isEqualTo(1);

		// O site é avisado: menu e as matérias da editoria.
		String payload = jdbc.sql("SELECT string_agg(payload::text, ' ') FROM job_queue WHERE type = 'CACHE_INVALIDATE'")
			.query(String.class).single();
		assertThat(payload).contains("\"taxonomy\"", "\"news:" + newsSlug + "\"", "\"category:esporte\"");
	}

	@Test
	void categoryRulesMatchTheScreen() throws Exception {
		String auth = TestSessions.bearer(jdbc, EDITOR);
		send("POST", "/api/v1/admin/categories", auth, category("Busca", "busca", "", "cidade", false))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[?(@.field == 'slug')].message").value(hasItem("“/busca” é usado por uma página fixa do site.")));
		send("POST", "/api/v1/admin/categories", auth, category("Meio Ambiente", "meio-ambiente", "", "", false))
			.andExpect(jsonPath("$.errors[?(@.field == 'color')].message").value(hasItem("Escolha a cor da editoria.")));
		send("POST", "/api/v1/admin/categories", auth, category("Praias", "praias", "gastronomia", "", false))
			.andExpect(jsonPath("$.errors[?(@.field == 'parentSlug')]").isNotEmpty());
		send("POST", "/api/v1/admin/categories", auth, category("Cidade 2", "cidade", "", "cidade", false))
			.andExpect(jsonPath("$.errors[?(@.field == 'slug')].message").value(hasItem("Já existe uma editoria com esse endereço.")));

		// 7 na barra + 1 = 8 (cabe); a 9ª não.
		send("POST", "/api/v1/admin/categories", auth, category("Meio Ambiente", "meio-ambiente", "", "cidade", true))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.slug == 'meio-ambiente')].inBar").value(hasItem(true)));
		send("POST", "/api/v1/admin/categories", auth, category("Saúde", "saude", "", "cidade", true))
			.andExpect(jsonPath("$.errors[?(@.field == 'inBar')].message").value(hasItem("A barra comporta até 8 editorias; tire uma antes.")));

		// Subeditoria: herda a cor e nunca vai para a barra.
		send("POST", "/api/v1/admin/categories", auth, category("Praias", "praias", "cidade", "esportes", true))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.slug == 'praias')].parentSlug").value(hasItem("cidade")))
			.andExpect(jsonPath("$[?(@.slug == 'praias')].inBar").value(hasItem(false)));
		assertThat(jdbc.sql("SELECT color FROM categories WHERE slug = 'praias'").query(String.class).optional())
			.isEmpty();
	}

	@Test
	void orderActivationAndDeletion() throws Exception {
		String auth = TestSessions.bearer(jdbc, EDITOR);
		String json = send("POST", "/api/v1/admin/categories/" + id("categories", "transito") + "/move", auth,
				"{\"direction\":-1}")
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		List<String> roots = com.jayway.jsonpath.JsonPath.read(json, "$[?(!@.parentSlug)].slug");
		assertThat(roots.subList(0, 2)).containsExactly("transito", "seguranca");

		send("POST", "/api/v1/admin/categories/" + id("categories", "entretenimento") + "/active", auth,
				"{\"active\":false}")
			.andExpect(jsonPath("$[?(@.slug == 'gastronomia')].active").value(hasItem(false)));

		send("DELETE", "/api/v1/admin/categories/" + id("categories", "cidade"), auth, null)
			.andExpect(status().isConflict());
		send("DELETE", "/api/v1/admin/categories/" + id("categories", "classificados"), auth, null)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].slug", not(hasItem("classificados"))));
	}

	@Test
	void reporterManagesTopicsButNotCategories() throws Exception {
		String auth = TestSessions.bearer(jdbc, REPORTER);
		send("GET", "/api/v1/admin/categories", auth, null).andExpect(status().isForbidden());
		send("GET", "/api/v1/admin/tags", auth, null).andExpect(status().isOk());
	}

	@Test
	void topicsAreRenamedAndMerged() throws Exception {
		String auth = TestSessions.bearer(jdbc, REPORTER);
		String chuva = id("tags", "chuva");
		String chuvas = id("tags", "chuvas");
		long total = jdbc.sql("""
				SELECT count(DISTINCT news_id) FROM news_tags nt JOIN news n ON n.id = nt.news_id
				WHERE n.deleted_at IS NULL AND nt.tag_id IN (:a::uuid, :b::uuid)""")
			.param("a", chuva).param("b", chuvas).query(Long.class).single();

		send("PUT", "/api/v1/admin/tags/" + chuvas, auth, "{\"name\":\"Chuva\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].message").value("Já existe “Chuva”. Para unir os dois, use “Juntar”."));

		send("POST", "/api/v1/admin/tags/merge", auth, "{\"keepId\":\"" + chuva + "\",\"mergeIds\":[\"" + chuvas + "\"]}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].slug", not(hasItem("chuvas"))))
			.andExpect(jsonPath("$[?(@.slug == 'chuva')].newsCount").value(hasItem((int) total)));

		send("PUT", "/api/v1/admin/tags/" + chuva, auth, "{\"name\":\"Chuvas fortes\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.slug == 'chuva')].name").value(hasItem("Chuvas fortes")));

		send("POST", "/api/v1/admin/tags/" + chuva + "/active", auth, "{\"active\":false}")
			.andExpect(jsonPath("$[?(@.slug == 'chuva')].active").value(hasItem(false)));
		mvc.perform(get("/api/v1/public/tags")).andExpect(jsonPath("$[*].slug", not(hasItem("chuva"))));
	}

}
