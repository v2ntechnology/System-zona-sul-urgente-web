package br.com.zonasulurgente.api.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

import br.com.zonasulurgente.api.TestcontainersConfiguration;

/** BE-004/BE-005: API pública de leitura sobre os dados de exemplo (perfil local). */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class PublicNewsApiTests {

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	private String slugIn(String categorySlug) {
		return jdbc.sql("""
				SELECT n.slug FROM news n JOIN categories c ON c.id = n.category_id
				WHERE c.slug = :c ORDER BY n.published_at DESC LIMIT 1""")
			.param("c", categorySlug).query(String.class).single();
	}

	@Test
	void latestIsPagedByCursorWithoutOverlapAndCacheable() throws Exception {
		String body = mvc.perform(get("/api/v1/public/news").param("limit", "5"))
			.andExpect(status().isOk())
			.andExpect(header().string("Cache-Control", containsString("s-maxage=60")))
			.andExpect(jsonPath("$.items", hasSize(5)))
			.andExpect(jsonPath("$.total", greaterThan(30)))
			.andReturn().getResponse().getContentAsString();
		String cursor = JsonPath.read(body, "$.nextCursor");
		List<String> first = JsonPath.read(body, "$.items[*].slug");

		String next = mvc.perform(get("/api/v1/public/news").param("limit", "5").param("cursor", cursor))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		List<String> second = JsonPath.read(next, "$.items[*].slug");
		assertThat(second).hasSize(5).doesNotContainAnyElementsOf(first);
	}

	@Test
	void badCursorAndLimitAreProblemJson400() throws Exception {
		mvc.perform(get("/api/v1/public/news").param("cursor", "lixo"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("Cursor de paginação inválido."));
		mvc.perform(get("/api/v1/public/news").param("limit", "0"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("limit"))
			.andExpect(jsonPath("$.errors[0].message").value("Use um limite entre 1 e 50."));
	}

	@Test
	void fullNewsHasAuthorsTagsBodyAndRelatedWithoutNulls() throws Exception {
		String slug = slugIn("seguranca");
		String body = mvc.perform(get("/api/v1/public/news/{slug}", slug))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.slug").value(slug))
			.andExpect(jsonPath("$.authors[0].name").exists())
			.andExpect(jsonPath("$.body[0].type").exists())
			.andExpect(jsonPath("$.related", hasSize(lessThanOrEqualTo(4))))
			.andExpect(jsonPath("$.related[*].slug", not(hasItem(slug))))
			.andExpect(jsonPath("$.category.slug").value("seguranca"))
			.andReturn().getResponse().getContentAsString();
		// Campo opcional ausente não vira null no JSON (contrato do frontend).
		assertThat(body).doesNotContain(":null");
	}

	@Test
	void unknownOrUnpublishedNewsIs404() throws Exception {
		mvc.perform(get("/api/v1/public/news/nao-existe")).andExpect(status().isNotFound());
		jdbc.sql("""
				INSERT INTO news (slug, title, summary, category_id)
				SELECT 'rascunho-secreto', 'Rascunho', 'Ainda não saiu', id FROM categories LIMIT 1""").update();
		mvc.perform(get("/api/v1/public/news/rascunho-secreto")).andExpect(status().isNotFound());
	}

	@Test
	void parentCategoryIncludesSubcategories() throws Exception {
		String gastronomia = slugIn("gastronomia");
		mvc.perform(get("/api/v1/public/categories/entretenimento/news").param("limit", "50"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.category.name").value("Entretenimento"))
			.andExpect(jsonPath("$.page.items[*].slug", hasItem(gastronomia)));
		mvc.perform(get("/api/v1/public/categories/nao-existe/news")).andExpect(status().isNotFound());
	}

	@Test
	void searchIgnoresAccentsAndToleratesTypos() throws Exception {
		mvc.perform(get("/api/v1/public/search").param("q", "TUNEL reboucas"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.total", greaterThan(0)));
		mvc.perform(get("/api/v1/public/search").param("q", "copacbana"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.total", greaterThan(0)));
		mvc.perform(get("/api/v1/public/search").param("q", "x".repeat(121)))
			.andExpect(status().isBadRequest());
	}

	@Test
	void mostReadSkipsSponsored() throws Exception {
		mvc.perform(get("/api/v1/public/news/most-read").param("period", "7d").param("limit", "50"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].isSponsored", everyItem(org.hamcrest.Matchers.is(false))));
		mvc.perform(get("/api/v1/public/news/most-read").param("period", "ontem"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void homeBlocks() throws Exception {
		mvc.perform(get("/api/v1/public/news/featured"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.main.slug").exists());
		mvc.perform(get("/api/v1/public/columns/latest"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(5)))
			.andExpect(jsonPath("$[0].column.columnist.name").exists());
		mvc.perform(get("/api/v1/public/categories"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].inBar").value(true));
	}

	@Test
	void resolvesCategoryNewsAndRedirect() throws Exception {
		mvc.perform(get("/api/v1/public/resolve").param("path", "entretenimento/gastronomia"))
			.andExpect(jsonPath("$.type").value("category"))
			.andExpect(jsonPath("$.category.slug").value("gastronomia"));

		String slug = slugIn("seguranca");
		mvc.perform(get("/api/v1/public/resolve").param("path", "seguranca/" + slug))
			.andExpect(jsonPath("$.type").value("news"))
			.andExpect(jsonPath("$.canonicalPath").value("/seguranca/" + slug));
		// Editoria desatualizada na URL: a matéria vem com o caminho certo (o site responde 301).
		mvc.perform(get("/api/v1/public/resolve").param("path", "cidade/" + slug))
			.andExpect(jsonPath("$.canonicalPath").value("/seguranca/" + slug));

		jdbc.sql("INSERT INTO path_redirects (old_path, new_path) VALUES ('/transito', '/mobilidade')").update();
		mvc.perform(get("/api/v1/public/resolve").param("path", "transito"))
			.andExpect(jsonPath("$.type").value("redirect"))
			.andExpect(jsonPath("$.location").value("/mobilidade"));

		mvc.perform(get("/api/v1/public/resolve").param("path", "nao-existe")).andExpect(status().isNotFound());
		mvc.perform(get("/api/v1/public/resolve").param("path", "../etc")).andExpect(status().isBadRequest());
	}

}
