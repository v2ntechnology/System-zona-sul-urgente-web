package br.com.zonasulurgente.api.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

import br.com.zonasulurgente.api.TestSessions;
import br.com.zonasulurgente.api.TestcontainersConfiguration;

/** BE-008: o que as ações gravam em audit_logs e a leitura pelo painel (perfil local). */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class AuditApiTests {

	static final String ADMIN = "juliana.prado@zonasulurgente.com.br";
	static final String EDITOR = "rafael.duarte@zonasulurgente.com.br";
	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	private static String draft(String title) {
		return """
				{"intent":"draft","draft":{"title":"%s","subtitle":"","summary":"Resumo com mais de trinta caracteres para o Google.",
				 "body":[{"type":"paragraph","html":"Texto da matéria auditada."}],
				 "categorySlug":"cidade","authorSlugs":["ana-ribeiro"],"neighborhoodSlug":"copacabana",
				 "tagSlugs":[],"newTags":[],"image":{"url":"https://picsum.photos/seed/a/1200/675","alt":"Rua","caption":"","credit":""},
				 "isUrgent":false,"isSponsored":false,"sponsorName":"","seo":{"title":"","description":""},
				 "status":"DRAFT","scheduledFor":"","origin":"MANUAL"}}""".formatted(title);
	}

	private Map<String, Object> row(String sql, Map<String, ?> params) {
		return jdbc.sql(sql).params(params).query().singleRow();
	}

	@Test
	void publishingRecordsUserIpRequestIdAndDiff() throws Exception {
		String admin = TestSessions.bearer(jdbc, ADMIN);
		String created = mvc.perform(post("/api/v1/admin/news").header("Authorization", admin)
				.contentType(MediaType.APPLICATION_JSON).content(draft("Matéria que vai para a auditoria")))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		String id = JsonPath.read(created, "$.id");

		mvc.perform(post("/api/v1/admin/news/{id}/publish", id).header("Authorization", admin)
				.header("X-Client-IP", "203.0.113.7").header("X-Request-Id", "req-auditoria-0001"))
			.andExpect(status().isOk());

		var publish = row("""
				SELECT a.actor_id = u.id AS by_admin, a.actor_name, a.origin, a.ip, a.request_id, a.entity_type,
				       a.entity_label, a.diff -> 'status' ->> 'from' AS from_status,
				       a.diff -> 'status' ->> 'to' AS to_status, jsonb_exists(a.diff, 'title') AS title_in_diff
				FROM audit_logs a, users u
				WHERE u.email = :email AND a.entity_id = :id AND a.action = 'PUBLISH'""",
				Map.of("email", ADMIN, "id", id));
		assertThat(publish).containsEntry("by_admin", true)
			.containsEntry("actor_name", "Juliana Prado")
			.containsEntry("origin", "PANEL")
			.containsEntry("ip", "203.0.113.7")
			.containsEntry("request_id", "req-auditoria-0001")
			.containsEntry("entity_type", "news")
			.containsEntry("entity_label", "Matéria que vai para a auditoria")
			.containsEntry("from_status", "DRAFT")
			.containsEntry("to_status", "PUBLISHED")
			.as("diff só com o que mudou")
			.containsEntry("title_in_diff", false);

		// A criação também ficou registrada, com os campos preenchidos.
		var create = row("""
				SELECT a.diff -> 'title' ->> 'to' AS title, a.details ->> 'origin' AS origin
				FROM audit_logs a WHERE a.entity_id = :id AND a.action = 'CREATE'""", Map.of("id", id));
		assertThat(create).containsEntry("title", "Matéria que vai para a auditoria").containsEntry("origin", "MANUAL");

		// O painel lê a linha do tempo da matéria, a mais recente primeiro.
		mvc.perform(get("/api/v1/admin/audit").param("entity", "news").param("entityId", id)
				.header("Authorization", admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items.length()").value(2))
			.andExpect(jsonPath("$.items[0].action").value("PUBLISH"))
			.andExpect(jsonPath("$.items[0].actor.name").value("Juliana Prado"))
			.andExpect(jsonPath("$.items[0].diff.status.to").value("PUBLISHED"))
			.andExpect(jsonPath("$.items[0].ip").value("203.0.113.7"))
			.andExpect(jsonPath("$.items[1].action").value("CREATE"))
			.andExpect(jsonPath("$.nextCursor").isEmpty());
	}

	@Test
	void failedLoginIsAuditedWithoutThePassword() throws Exception {
		String password = "SenhaErradaQueNaoPodeVazar-123";
		mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
				.header("X-Client-IP", "198.51.100.20")
				.content("{\"email\":\"" + REPORTER + "\",\"password\":\"" + password + "\"}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"ninguem@exemplo.com\",\"password\":\"" + password + "\"}"))
			.andExpect(status().isUnauthorized());

		var failed = row("""
				SELECT a.entity_id = u.id::text AS target, a.actor_id IS NULL AS no_actor, a.ip,
				       a.details ->> 'reason' AS reason, a.details ->> 'email' AS email
				FROM audit_logs a, users u
				WHERE u.email = :email AND a.action = 'LOGIN_FAILED' AND a.entity_id = u.id::text""",
				Map.of("email", REPORTER));
		assertThat(failed).containsEntry("target", true)
			.containsEntry("no_actor", true)
			.containsEntry("ip", "198.51.100.20")
			.containsEntry("reason", "wrong_password")
			.containsEntry("email", REPORTER);
		assertThat(jdbc.sql("""
				SELECT details ->> 'reason' FROM audit_logs
				WHERE action = 'LOGIN_FAILED' AND entity_id IS NULL AND details ->> 'email' = 'ninguem@exemplo.com'""")
			.query(String.class).single()).isEqualTo("unknown_email");

		String everything = jdbc.sql("SELECT string_agg(a::text, ' ') FROM audit_logs a").query(String.class).single();
		assertThat(everything).doesNotContain(password);

		// Entrada certa: LOGIN em nome da própria pessoa.
		mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + REPORTER + "\",\"password\":\"zonasul-local\"}"))
			.andExpect(status().isOk());
		assertThat(jdbc.sql("""
				SELECT a.actor_name || '|' || (a.details ->> 'method') FROM audit_logs a
				WHERE a.action = 'LOGIN' AND a.actor_id = (SELECT id FROM users WHERE email = :email)""")
			.param("email", REPORTER).query(String.class).single()).isEqualTo("Ana Ribeiro|password");
	}

	@Test
	void instagramDraftRecordsAiGenerationWithTheModel() throws Exception {
		String auth = TestSessions.bearer(jdbc, REPORTER);
		mvc.perform(post("/api/v1/admin/instagram/posts").header("Authorization", auth)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"url":"https://www.instagram.com/p/DAudit1234/","caption":"Feira livre volta à Praça General Osório, em Ipanema, neste domingo. Barracas das 7h às 13h."}"""))
			.andExpect(status().isCreated());
		mvc.perform(post("/api/v1/admin/instagram/posts/DAudit1234/generate").header("Authorization", auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("IMPORTED"));

		String newsId = jdbc.sql("SELECT news_id::text FROM instagram_posts WHERE id = 'DAudit1234'")
			.query(String.class).single();
		var ai = row("""
				SELECT a.entity_type, a.actor_name, a.details ->> 'model' AS model,
				       a.details ->> 'instagramPostId' AS post
				FROM audit_logs a WHERE a.action = 'AI_GENERATION' AND a.entity_id = :id""", Map.of("id", newsId));
		assertThat(ai).containsEntry("entity_type", "news")
			.containsEntry("actor_name", "Ana Ribeiro")
			.containsEntry("model", "fake")
			.containsEntry("post", "DAudit1234");
		assertThat(jdbc.sql("""
				SELECT string_agg(action, ',' ORDER BY action) FROM audit_logs
				WHERE entity_id IN (:news, 'DAudit1234')""").param("news", newsId).query(String.class).single())
			.isEqualTo("AI_GENERATION,CREATE,INSTAGRAM_IMPORT");
	}

	@Test
	void teamChangesAreAuditedWithoutTheInviteToken() throws Exception {
		String admin = TestSessions.bearer(jdbc, ADMIN);
		String body = mvc.perform(post("/api/v1/admin/users/invite").header("Authorization", admin)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Pessoa Auditada\",\"email\":\"auditada@exemplo.com\",\"role\":\"REPORTER\",\"createAuthor\":false}"))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		String token = JsonPath.read(body, "$.inviteToken");
		String userId = jdbc.sql("SELECT id::text FROM users WHERE email = 'auditada@exemplo.com'").query(String.class)
			.single();
		mvc.perform(post("/api/v1/admin/users/{id}/role", userId).header("Authorization", admin)
				.contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"EDITOR\"}"))
			.andExpect(status().isOk());
		mvc.perform(post("/api/v1/admin/auth/invite/accept").contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\":\"" + token + "\",\"password\":\"uma-senha-bem-longa\"}"))
			.andExpect(status().isOk());

		assertThat(jdbc.sql("""
				SELECT string_agg(action || ':' || coalesce(actor_name, '-'), ',' ORDER BY occurred_at, id)
				FROM audit_logs WHERE entity_type = 'user' AND entity_id = :id""").param("id", userId)
			.query(String.class).single())
			.isEqualTo("INVITE:Juliana Prado,ROLE_CHANGE:Juliana Prado,INVITE_ACCEPT:Pessoa Auditada");
		assertThat(jdbc.sql("""
				SELECT (diff -> 'role' ->> 'from') || '>' || (diff -> 'role' ->> 'to') FROM audit_logs
				WHERE action = 'ROLE_CHANGE' AND entity_id = :id""").param("id", userId).query(String.class).single())
			.isEqualTo("REPORTER>EDITOR");
		String everything = jdbc.sql("SELECT string_agg(a::text, ' ') FROM audit_logs a").query(String.class).single();
		assertThat(everything).doesNotContain(token).doesNotContain("uma-senha-bem-longa");
	}

	@Test
	void onlyWhoHasAuditViewReadsTheLog() throws Exception {
		mvc.perform(get("/api/v1/admin/audit")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/admin/audit").header("Authorization", TestSessions.bearer(jdbc, EDITOR)))
			.andExpect(status().isForbidden());
		mvc.perform(get("/api/v1/admin/audit").header("Authorization", TestSessions.bearer(jdbc, REPORTER)))
			.andExpect(status().isForbidden());

		// Admin pagina pelo cursor; filtro inválido é 400.
		String admin = TestSessions.bearer(jdbc, ADMIN);
		for (String title : new String[] { "Primeira matéria auditada", "Segunda matéria auditada" }) {
			mvc.perform(post("/api/v1/admin/news").header("Authorization", admin)
					.contentType(MediaType.APPLICATION_JSON).content(draft(title)))
				.andExpect(status().isOk());
		}
		String first = mvc.perform(get("/api/v1/admin/audit").param("action", "CREATE").param("entity", "news")
				.param("limit", "1").header("Authorization", admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items.length()").value(1))
			.andExpect(jsonPath("$.items[0].entityLabel").value("Segunda matéria auditada"))
			.andReturn().getResponse().getContentAsString();
		String cursor = JsonPath.read(first, "$.nextCursor");
		mvc.perform(get("/api/v1/admin/audit").param("action", "CREATE").param("entity", "news").param("limit", "1")
				.param("cursor", cursor).header("Authorization", admin))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items[0].entityLabel").value("Primeira matéria auditada"));
		mvc.perform(get("/api/v1/admin/audit").param("action", "drop table").header("Authorization", admin))
			.andExpect(status().isBadRequest());
	}

}
