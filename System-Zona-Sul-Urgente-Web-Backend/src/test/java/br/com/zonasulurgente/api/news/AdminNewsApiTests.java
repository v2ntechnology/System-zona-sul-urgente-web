package br.com.zonasulurgente.api.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.UUID;

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

import com.jayway.jsonpath.JsonPath;

import br.com.zonasulurgente.api.TestcontainersConfiguration;
import br.com.zonasulurgente.api.auth.application.Tokens;

/** BE-009: CRUD de notícias do painel com as permissões da matriz (perfil local). */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class AdminNewsApiTests {

	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";
	static final String ADMIN = "juliana.prado@zonasulurgente.com.br";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	/** Sessão pronta para a pessoa (sem passar pelo 2FA, que tem teste próprio). */
	private String token(String email) {
		String token = Tokens.newToken();
		jdbc.sql("""
				INSERT INTO sessions (token_hash, user_id, expires_at)
				SELECT :hash, id, :expires FROM users WHERE email = :email""")
			.param("hash", Tokens.hash(token))
			.param("expires", OffsetDateTime.now().plusDays(1))
			.param("email", email)
			.update();
		return "Bearer " + token;
	}

	private static String draft(String title, String extra) {
		return """
				{"title":"%s","subtitle":"","summary":"Resumo com mais de trinta caracteres para o Google.",
				 "body":[{"type":"paragraph","html":"Texto <strong>forte</strong> <script>alert(1)</script><a href=\\"javascript:x\\">link</a> <a href=\\"https://exemplo.com\\" onclick=\\"x()\\">ok</a>"}],
				 "categorySlug":"cidade","authorSlugs":["ana-ribeiro"],"neighborhoodSlug":"copacabana",
				 "tagSlugs":["chuva"],"newTags":[],"image":{"url":"https://picsum.photos/seed/t/1200/675","alt":"Rua alagada","caption":"","credit":""},
				 "isUrgent":false,"isSponsored":false,"sponsorName":"","seo":{"title":"","description":""},
				 "status":"DRAFT","scheduledFor":"","origin":"MANUAL"%s}""".formatted(title, extra);
	}

	private ResultActions create(String auth, String title, String intent) throws Exception {
		return mvc.perform(post("/api/v1/admin/news").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
			.content("{\"intent\":\"" + intent + "\",\"draft\":" + draft(title, "") + "}"));
	}

	private String id(ResultActions result) throws Exception {
		return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
	}

	@Test
	void reporterCreatesDraftAndSendsToReviewButCannotPublish() throws Exception {
		String ana = token(REPORTER);
		String id = id(create(ana, "Rascunho da repórter sobre chuva", "draft").andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("DRAFT")));
		mvc.perform(get("/api/v1/admin/news/{id}", id).header("Authorization", ana))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.authorSlugs[0]").value("ana-ribeiro"))
			.andExpect(jsonPath("$.version").value(1));

		create(ana, "Repórter tentando publicar direto", "publish").andExpect(status().isForbidden());
		mvc.perform(put("/api/v1/admin/news/{id}", id).header("Authorization", ana).contentType(MediaType.APPLICATION_JSON)
				.content("{\"intent\":\"review\",\"draft\":" + draft("Rascunho da repórter sobre chuva", ",\"version\":1") + "}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("IN_REVIEW"))
			.andExpect(jsonPath("$.version").value(2));
		mvc.perform(post("/api/v1/admin/news/{id}/publish", id).header("Authorization", ana))
			.andExpect(status().isForbidden());
	}

	@Test
	void reporterCannotEditSomeoneElsesNews() throws Exception {
		String othersId = jdbc.sql("""
				SELECT n.id::text FROM news n WHERE NOT EXISTS (SELECT 1 FROM news_authors na JOIN authors a ON a.id = na.author_id
				WHERE na.news_id = n.id AND a.slug = 'ana-ribeiro') AND n.status = 'DRAFT' LIMIT 1""")
			.query(String.class).optional().orElseGet(() -> {
				try {
					return id(create(token(ADMIN), "Rascunho de outra pessoa", "draft"));
				}
				catch (Exception ex) {
					throw new IllegalStateException(ex);
				}
			});
		jdbc.sql("DELETE FROM news_authors WHERE news_id = :id::uuid").param("id", othersId).update();
		jdbc.sql("UPDATE news SET created_by = (SELECT id FROM users WHERE email = :e) WHERE id = :id::uuid")
			.param("e", ADMIN).param("id", othersId).update();
		mvc.perform(put("/api/v1/admin/news/{id}", othersId).header("Authorization", token(REPORTER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"intent\":\"draft\",\"draft\":" + draft("Mexendo no que não é meu", "") + "}"))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value("Você só pode editar as suas matérias."));
	}

	@Test
	void publishedNewsGoesLiveWithSanitizedBodyAndReusedTopic() throws Exception {
		String admin = token(ADMIN);
		String body = mvc.perform(post("/api/v1/admin/news").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
				.content("{\"intent\":\"publish\",\"draft\":" + draft("Matéria publicada pelo painel agora",
						",\"newTags\":[\"Chuvas\",\"Meio ambiente\"]") + "}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PUBLISHED"))
			.andReturn().getResponse().getContentAsString();
		String slug = JsonPath.read(body, "$.slug");
		assertThat(slug).isEqualTo("materia-publicada-pelo-painel-agora");

		String html = mvc.perform(get("/api/v1/public/news/{slug}", slug))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.tags[*].slug", hasItem("chuva")))
			.andExpect(jsonPath("$.tags[*].name", hasItem("Meio ambiente")))
			.andReturn().getResponse().getContentAsString();
		String paragraph = JsonPath.read(html, "$.body[0].html");
		assertThat(paragraph).contains("<strong>forte</strong>", "href=\"https://exemplo.com\"")
			.doesNotContain("script", "javascript:", "onclick");
		// "Chuvas" reaproveitou "Chuva" (mesmo nome normalizado): nenhum tópico duplicado.
		assertThat(jdbc.sql("SELECT count(*) FROM tags WHERE slug IN ('chuvas-2', 'chuva-2')").query(Long.class).single())
			.isZero();
	}

	@Test
	void validationErrorsUseTheEditorFieldNames() throws Exception {
		mvc.perform(post("/api/v1/admin/news").header("Authorization", token(ADMIN)).contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"intent":"publish","draft":{"title":"Curto","summary":"","body":[],"categorySlug":"cidade",
						 "authorSlugs":[],"image":{"url":"","alt":"","caption":"","credit":""},"isUrgent":false,
						 "isSponsored":true,"sponsorName":"","status":"DRAFT","scheduledFor":"","origin":"MANUAL"}}"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[*].field", hasItem("title")))
			.andExpect(jsonPath("$.errors[*].field", hasItem("summary")))
			.andExpect(jsonPath("$.errors[*].field", hasItem("body")))
			.andExpect(jsonPath("$.errors[*].field", hasItem("authorSlugs")))
			.andExpect(jsonPath("$.errors[*].field", hasItem("image.url")))
			.andExpect(jsonPath("$.errors[*].field", hasItem("sponsorName")));
	}

	@Test
	void concurrentEditIsRejectedWith409() throws Exception {
		String admin = token(ADMIN);
		String id = id(create(admin, "Notícia editada por duas pessoas", "draft"));
		String v1 = "{\"intent\":\"draft\",\"draft\":" + draft("Notícia editada por duas pessoas", ",\"version\":1") + "}";
		mvc.perform(put("/api/v1/admin/news/{id}", id).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(v1))
			.andExpect(status().isOk());
		mvc.perform(put("/api/v1/admin/news/{id}", id).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(v1))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.title").value("Notícia alterada por outra pessoa"));
		mvc.perform(get("/api/v1/admin/news/{id}/versions", id).header("Authorization", admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].version").value(2))
			.andExpect(jsonPath("$[0].createdBy").value("Juliana Prado"));
	}

	@Test
	void trashHidesFromTheSiteAndRestoreBringsBack() throws Exception {
		String admin = token(ADMIN);
		String body = create(admin, "Notícia que vai para a lixeira", "publish").andReturn().getResponse().getContentAsString();
		String id = JsonPath.read(body, "$.id");
		String slug = JsonPath.read(body, "$.slug");
		mvc.perform(delete("/api/v1/admin/news/{id}", id).header("Authorization", admin)).andExpect(status().isOk());
		mvc.perform(get("/api/v1/public/news/{slug}", slug)).andExpect(status().isNotFound());
		mvc.perform(get("/api/v1/admin/news").param("status", "DELETED").header("Authorization", admin))
			.andExpect(jsonPath("$.items[*].id", hasItem(id)));
		mvc.perform(delete("/api/v1/admin/news/{id}", id).header("Authorization", token(REPORTER)))
			.andExpect(status().isForbidden());
		mvc.perform(post("/api/v1/admin/news/{id}/restore", id).header("Authorization", admin)).andExpect(status().isOk());
		mvc.perform(get("/api/v1/public/news/{slug}", slug)).andExpect(status().isOk());
		mvc.perform(post("/api/v1/admin/news/{id}/unpublish", id).header("Authorization", admin))
			.andExpect(jsonPath("$.status").value("UNPUBLISHED"));
		mvc.perform(get("/api/v1/public/news/{slug}", slug)).andExpect(status().isNotFound());
	}

	@Test
	void listingSearchesAndCounts() throws Exception {
		String admin = token(ADMIN);
		mvc.perform(get("/api/v1/admin/news").param("q", "reboucas").header("Authorization", admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThan(0)));
		mvc.perform(get("/api/v1/admin/news/counts").header("Authorization", admin))
			.andExpect(jsonPath("$.ALL").value(org.hamcrest.Matchers.greaterThan(30)));
		mvc.perform(get("/api/v1/admin/news/{id}", UUID.randomUUID()).header("Authorization", admin))
			.andExpect(status().isNotFound());
		mvc.perform(get("/api/v1/admin/news")).andExpect(status().isUnauthorized());
	}

}
