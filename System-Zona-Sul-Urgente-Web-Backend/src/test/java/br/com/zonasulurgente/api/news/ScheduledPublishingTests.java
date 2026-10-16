package br.com.zonasulurgente.api.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpServer;

import br.com.zonasulurgente.api.TestcontainersConfiguration;
import br.com.zonasulurgente.api.auth.application.Tokens;
import br.com.zonasulurgente.api.jobs.JobWorker;
import br.com.zonasulurgente.api.news.admin.AdminNewsService;

/**
 * BE-010/011: agendada vai ao ar sozinha no horário e o site recebe o aviso de revalidação
 * (um servidor HTTP de teste faz o papel do Next em /api/revalidate).
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class ScheduledPublishingTests {

	static final String SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
	static final List<String> received = new CopyOnWriteArrayList<>();
	static final HttpServer site;

	static {
		try {
			site = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		}
		catch (IOException e) {
			throw new IllegalStateException(e);
		}
		site.createContext("/api/revalidate", exchange -> {
			String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
			received.add(exchange.getRequestHeaders().getFirst("Authorization") + " " + body);
			exchange.sendResponseHeaders(200, -1);
			exchange.close();
		});
		site.start();
	}

	@DynamicPropertySource
	static void siteProperties(DynamicPropertyRegistry registry) {
		registry.add("zsu.site.revalidate-url", () -> "http://127.0.0.1:" + site.getAddress().getPort());
		registry.add("zsu.site.revalidate-secret", () -> SECRET);
	}

	@AfterAll
	static void stop() {
		site.stop(0);
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	@Autowired
	AdminNewsService news;

	@Autowired
	JobWorker worker;

	private String token() {
		String token = Tokens.newToken();
		jdbc.sql("""
				INSERT INTO sessions (token_hash, user_id, expires_at)
				SELECT :hash, id, :expires FROM users WHERE email = 'juliana.prado@zonasulurgente.com.br'""")
			.param("hash", Tokens.hash(token))
			.param("expires", OffsetDateTime.now().plusDays(1))
			.update();
		return "Bearer " + token;
	}

	private String schedule(String title) throws Exception {
		String draft = """
				{"title":"%s","subtitle":"","summary":"Resumo com mais de trinta caracteres para o Google.",
				 "body":[{"type":"paragraph","html":"Texto da matéria agendada."}],
				 "categorySlug":"cidade","authorSlugs":["juliana-prado"],"neighborhoodSlug":"copacabana",
				 "tagSlugs":[],"newTags":[],"image":{"url":"https://picsum.photos/seed/s/1200/675","alt":"Praia","caption":"","credit":""},
				 "isUrgent":false,"isSponsored":false,"sponsorName":"","seo":{"title":"","description":""},
				 "status":"DRAFT","scheduledFor":"2099-01-01T10:00","origin":"MANUAL"}""".formatted(title);
		String json = mvc.perform(post("/api/v1/admin/news").header("Authorization", token())
				.contentType(MediaType.APPLICATION_JSON).content("{\"intent\":\"schedule\",\"draft\":" + draft + "}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("SCHEDULED"))
			.andReturn().getResponse().getContentAsString();
		return JsonPath.read(json, "$.slug");
	}

	@Test
	void dueScheduledNewsGoesLiveAtTheScheduledTimeAndTheSiteIsNotified() throws Exception {
		String slug = schedule("Mutirão de limpeza agendado na praia");
		// O horário chegou (há 1 minuto).
		jdbc.sql("UPDATE news SET scheduled_for = now() - interval '1 minute' WHERE slug = :slug").param("slug", slug)
			.update();
		OffsetDateTime scheduled = jdbc.sql("SELECT scheduled_for FROM news WHERE slug = :slug").param("slug", slug)
			.query(OffsetDateTime.class).single();
		jdbc.sql("DELETE FROM job_queue").update();

		assertThat(news.publishDue()).isEqualTo(1);

		var row = jdbc.sql("SELECT status, published_at, scheduled_for, version FROM news WHERE slug = :slug")
			.param("slug", slug)
			.query((rs, i) -> List.of(rs.getString(1), rs.getObject(2, OffsetDateTime.class).toInstant(),
					String.valueOf(rs.getObject(3)), rs.getInt(4)))
			.single();
		assertThat(row.get(0)).isEqualTo("PUBLISHED");
		assertThat(row.get(1)).as("vai ao ar com o horário marcado").isEqualTo(scheduled.toInstant());
		assertThat(row.get(2)).isEqualTo("null");
		assertThat(jdbc.sql("SELECT count(*) FROM news_versions v JOIN news n ON n.id = v.news_id WHERE n.slug = :slug")
			.param("slug", slug).query(Long.class).single()).isEqualTo(2);
		mvc.perform(get("/api/v1/public/news/{slug}", slug)).andExpect(status().isOk());
		assertThat(news.publishDue()).as("não publica duas vezes").isZero();

		// O job de revalidação avisa o site com as tags da matéria.
		received.clear();
		assertThat(worker.runOnce()).isEqualTo(1);
		assertThat(received).hasSize(1);
		assertThat(received.getFirst()).startsWith("Bearer " + SECRET + " ")
			.contains("\"news:" + slug + "\"", "\"home\"", "\"news\"", "\"category:cidade\"",
					"\"neighborhood:copacabana\"");
		assertThat(jdbc.sql("SELECT status FROM job_queue").query(String.class).single()).isEqualTo("COMPLETED");
	}

	@Test
	void futureScheduledNewsWaits() throws Exception {
		schedule("Show agendado para o futuro distante");
		jdbc.sql("DELETE FROM job_queue").update();
		assertThat(news.publishDue()).isZero();
		assertThat(jdbc.sql("SELECT count(*) FROM job_queue").query(Long.class).single())
			.as("agendar não mexe no site").isZero();
	}

}
