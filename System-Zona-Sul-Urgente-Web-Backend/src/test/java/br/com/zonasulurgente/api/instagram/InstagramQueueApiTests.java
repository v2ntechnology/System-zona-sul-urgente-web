package br.com.zonasulurgente.api.instagram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

/** Fila do Instagram (FE-155/BE-013) com a IA falsa (zsu.ai.provider=fake, o padrão). */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class InstagramQueueApiTests {

	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";
	static final String COMERCIAL = "sandra.lopes@zonasulurgente.com.br";
	static final String CAPTION = """
			Árvore caiu na Rua Voluntários da Pátria, em Botafogo. Via interditada no sentido Centro.

			Equipes da Comlurb já estão no local. #botafogo @cetrio""";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	private ResultActions post(String path, String auth, String json) throws Exception {
		var request = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path)
			.header("Authorization", auth);
		if (json != null) {
			request.contentType(MediaType.APPLICATION_JSON).content(json);
		}
		return mvc.perform(request);
	}

	private static String importBody(String url, String caption) {
		return """
				{"url":"%s","caption":"%s"}""".formatted(url, caption.replace("\n", "\\n"));
	}

	@Test
	void importedPostBecomesAnInstagramDraftOnlyOnce() throws Exception {
		String auth = TestSessions.bearer(jdbc, REPORTER);

		post("/api/v1/admin/instagram/posts", auth,
				importBody("https://www.instagram.com/zonasulurgente/p/DAbc123xyz/?igsh=x", CAPTION))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").value("DAbc123xyz"))
			.andExpect(jsonPath("$.permalink").value("https://www.instagram.com/p/DAbc123xyz/"))
			.andExpect(jsonPath("$.status").value("NEW"))
			.andExpect(jsonPath("$.news").doesNotExist());

		post("/api/v1/admin/instagram/posts", auth,
				importBody("https://instagram.com/p/DAbc123xyz/", CAPTION))
			.andExpect(status().isConflict());

		post("/api/v1/admin/instagram/posts/DAbc123xyz/generate", auth, null)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("IMPORTED"))
			.andExpect(jsonPath("$.attempts").value(1))
			.andExpect(jsonPath("$.news.status").value("DRAFT"))
			.andExpect(jsonPath("$.news.paragraphs.length()").value(2));

		var news = jdbc.sql("""
				SELECT n.origin, n.status, ip.ai_provider, ip.ai_output IS NOT NULL AS has_output
				FROM instagram_posts ip JOIN news n ON n.id = ip.news_id WHERE ip.id = 'DAbc123xyz'""")
			.query((rs, i) -> rs.getString(1) + "|" + rs.getString(2) + "|" + rs.getString(3) + "|"
					+ rs.getBoolean(4))
			.single();
		assertThat(news).isEqualTo("INSTAGRAM|DRAFT|fake|true");

		// Segundo clique: não cria outra notícia.
		post("/api/v1/admin/instagram/posts/DAbc123xyz/generate", auth, null).andExpect(status().isConflict());
		assertThat(jdbc.sql("SELECT count(*) FROM news WHERE origin = 'INSTAGRAM' AND created_by = "
				+ "(SELECT id FROM users WHERE email = :e)").param("e", REPORTER).query(Long.class).single())
			.isEqualTo(1);

		// O editor mostra a legenda original ao lado da notícia.
		String newsId = jdbc.sql("SELECT news_id::text FROM instagram_posts WHERE id = 'DAbc123xyz'")
			.query(String.class).single();
		mvc.perform(get("/api/v1/admin/news/" + newsId).header("Authorization", auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.origin").value("INSTAGRAM"))
			.andExpect(jsonPath("$.instagramCaption").value(CAPTION));
	}

	@Test
	void aiFailureBecomesErrorThatCanBeReprocessed() throws Exception {
		String auth = TestSessions.bearer(jdbc, REPORTER);
		// Só hashtags: a IA (falsa) não tem o que escrever.
		post("/api/v1/admin/instagram/posts", auth, importBody("https://www.instagram.com/reel/DReel9999/", "#chuva @rio"))
			.andExpect(jsonPath("$.mediaType").value("VIDEO"));

		post("/api/v1/admin/instagram/posts/DReel9999/generate", auth, null)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("ERROR"))
			.andExpect(jsonPath("$.attempts").value(1))
			.andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("campo paragrafos vazio")));

		mvc.perform(get("/api/v1/admin/instagram/posts/counts").header("Authorization", auth))
			.andExpect(jsonPath("$.ERROR").value(1));
	}

	@Test
	void ignoreAndRestore() throws Exception {
		String auth = TestSessions.bearer(jdbc, REPORTER);
		post("/api/v1/admin/instagram/posts", auth, importBody("https://www.instagram.com/p/DIgnore01/", CAPTION));

		post("/api/v1/admin/instagram/posts/DIgnore01/ignore", auth, null)
			.andExpect(jsonPath("$.status").value("IGNORED"))
			.andExpect(jsonPath("$.ignoredReason").value("Ignorado por Ana Ribeiro."));
		post("/api/v1/admin/instagram/posts/DIgnore01/generate", auth, null).andExpect(status().isConflict());
		post("/api/v1/admin/instagram/posts/DIgnore01/restore", auth, null)
			.andExpect(jsonPath("$.status").value("NEW"))
			.andExpect(jsonPath("$.ignoredReason").doesNotExist());

		mvc.perform(get("/api/v1/admin/instagram/posts").param("status", "NEW").header("Authorization", auth))
			.andExpect(jsonPath("$[0].id").value("DIgnore01"));
	}

	@Test
	void rejectsInvalidLinkAndProfileWithoutPermission() throws Exception {
		post("/api/v1/admin/instagram/posts", TestSessions.bearer(jdbc, REPORTER),
				importBody("https://www.facebook.com/post/1", CAPTION))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("url"));

		mvc.perform(get("/api/v1/admin/instagram/posts").header("Authorization", TestSessions.bearer(jdbc, COMERCIAL)))
			.andExpect(status().isForbidden());
		mvc.perform(get("/api/v1/admin/instagram/posts")).andExpect(status().isUnauthorized());
	}

}
