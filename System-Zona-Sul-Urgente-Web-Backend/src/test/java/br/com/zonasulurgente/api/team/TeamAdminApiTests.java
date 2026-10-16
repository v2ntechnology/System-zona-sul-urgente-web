package br.com.zonasulurgente.api.team;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

import com.jayway.jsonpath.JsonPath;

import br.com.zonasulurgente.api.TestSessions;
import br.com.zonasulurgente.api.TestcontainersConfiguration;

/** FE-159 na API: convite por link com aceite, regras de acesso e autores. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class TeamAdminApiTests {

	static final String ADMIN = "juliana.prado@zonasulurgente.com.br";
	static final String EDITOR = "rafael.duarte@zonasulurgente.com.br";
	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	private ResultActions postJson(String path, String auth, String json) throws Exception {
		var request = post(path).contentType(MediaType.APPLICATION_JSON).content(json);
		if (auth != null) {
			request.header("Authorization", auth);
		}
		return mvc.perform(request);
	}

	private String userId(String email) {
		return jdbc.sql("SELECT id::text FROM users WHERE email = :e").param("e", email).query(String.class).single();
	}

	@Test
	void invitedPersonCreatesPasswordThroughTheLinkAndLogsIn() throws Exception {
		String auth = TestSessions.bearer(jdbc, ADMIN);
		String json = postJson("/api/v1/admin/users/invite", auth, """
				{"name":"Bruna Castro","email":"Bruna.Castro@zonasulurgente.com.br","role":"REPORTER","createAuthor":true}""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.team[?(@.email == 'bruna.castro@zonasulurgente.com.br')].status").value(hasItem("INVITED")))
			.andExpect(jsonPath("$.team[?(@.email == 'bruna.castro@zonasulurgente.com.br')].authorSlug").value(hasItem("bruna-castro")))
			.andReturn().getResponse().getContentAsString();
		String token = JsonPath.read(json, "$.inviteToken");
		assertThat(jdbc.sql("SELECT role FROM authors WHERE slug = 'bruna-castro'").query(String.class).single())
			.isEqualTo("Repórter");

		// Antes de aceitar não entra.
		postJson("/api/v1/admin/auth/login", null,
				"{\"email\":\"bruna.castro@zonasulurgente.com.br\",\"password\":\"qualquer-coisa\"}")
			.andExpect(status().isUnauthorized());

		postJson("/api/v1/admin/auth/invite/check", null, "{\"token\":\"" + token + "\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Bruna Castro"));
		postJson("/api/v1/admin/auth/invite/accept", null, "{\"token\":\"" + token + "\",\"password\":\"curta\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("password"));
		postJson("/api/v1/admin/auth/invite/accept", null,
				"{\"token\":\"" + token + "\",\"password\":\"orla-de-copacabana-2026\"}")
			.andExpect(status().isOk());

		String login = postJson("/api/v1/admin/auth/login", null,
				"{\"email\":\"bruna.castro@zonasulurgente.com.br\",\"password\":\"orla-de-copacabana-2026\"}")
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		mvc.perform(get("/api/v1/admin/auth/me").header("Authorization", "Bearer " + JsonPath.read(login, "$.session.token")))
			.andExpect(jsonPath("$.role").value("REPORTER"))
			.andExpect(jsonPath("$.authorSlug").value("bruna-castro"));

		// O link serve uma vez só.
		postJson("/api/v1/admin/auth/invite/check", null, "{\"token\":\"" + token + "\"}")
			.andExpect(status().isNotFound());
	}

	@Test
	void newLinkInvalidatesThePreviousOne() throws Exception {
		String auth = TestSessions.bearer(jdbc, ADMIN);
		String id = userId("lucas.ferreira@zonasulurgente.com.br");
		String first = JsonPath.read(postJson("/api/v1/admin/users/" + id + "/invite", auth, "{}")
			.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.inviteToken");
		String second = JsonPath.read(postJson("/api/v1/admin/users/" + id + "/invite", auth, "{}")
			.andReturn().getResponse().getContentAsString(), "$.inviteToken");
		postJson("/api/v1/admin/auth/invite/check", null, "{\"token\":\"" + first + "\"}").andExpect(status().isNotFound());
		postJson("/api/v1/admin/auth/invite/check", null, "{\"token\":\"" + second + "\"}").andExpect(status().isOk());
		postJson("/api/v1/admin/users/" + userId(REPORTER) + "/invite", auth, "{}").andExpect(status().isConflict());
	}

	@Test
	void accessRules() throws Exception {
		String auth = TestSessions.bearer(jdbc, ADMIN);
		postJson("/api/v1/admin/users/invite", auth,
				"{\"name\":\"Ana\",\"email\":\"ana.ribeiro@zonasulurgente.com.br\",\"role\":\"\",\"createAuthor\":false}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[*].field").value(org.hamcrest.Matchers.contains("email", "name", "role")));

		// Ninguém mexe no próprio acesso.
		postJson("/api/v1/admin/users/" + userId(ADMIN) + "/role", auth, "{\"role\":\"EDITOR\"}")
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("Você não pode alterar o seu próprio acesso."));

		// Desativar derruba a sessão na hora.
		String ana = TestSessions.bearer(jdbc, REPORTER);
		mvc.perform(get("/api/v1/admin/auth/me").header("Authorization", ana)).andExpect(status().isOk());
		postJson("/api/v1/admin/users/" + userId(REPORTER) + "/active", auth, "{\"active\":false}")
			.andExpect(jsonPath("$[?(@.email == '" + REPORTER + "')].status").value(hasItem("DISABLED")));
		mvc.perform(get("/api/v1/admin/auth/me").header("Authorization", ana)).andExpect(status().isUnauthorized());
		postJson("/api/v1/admin/users/" + userId(REPORTER) + "/active", auth, "{\"active\":true}")
			.andExpect(jsonPath("$[?(@.email == '" + REPORTER + "')].status").value(hasItem("ACTIVE")));

		// Trocar perfil e zerar o 2FA.
		jdbc.sql("INSERT INTO user_totp (user_id, secret_encrypted, confirmed_at) VALUES (:id::uuid, 'x', now())")
			.param("id", userId(EDITOR)).update();
		postJson("/api/v1/admin/users/" + userId(EDITOR) + "/reset-2fa", auth, "{}")
			.andExpect(jsonPath("$[?(@.email == '" + EDITOR + "')].twoFactor").value(hasItem(false)));
		postJson("/api/v1/admin/users/" + userId(EDITOR) + "/role", auth, "{\"role\":\"ADMIN\"}")
			.andExpect(jsonPath("$[?(@.email == '" + EDITOR + "')].role").value(hasItem("ADMIN")));

		// Só o Administrador gerencia a equipe.
		mvc.perform(get("/api/v1/admin/users").header("Authorization", TestSessions.bearer(jdbc, "carlos.menezes@zonasulurgente.com.br")))
			.andExpect(status().isForbidden());
	}

	@Test
	void authorsWithoutLogin() throws Exception {
		String auth = TestSessions.bearer(jdbc, EDITOR);
		String json = postJson("/api/v1/admin/authors", auth,
				"{\"name\":\"Agência Brasil\",\"role\":\"Agência\",\"bio\":\"\",\"instagram\":\"@agenciabrasil\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.slug == 'agencia-brasil')].instagram").value(hasItem("agenciabrasil")))
			.andReturn().getResponse().getContentAsString();
		postJson("/api/v1/admin/authors", auth, "{\"name\":\"Agência Brasil\",\"role\":\"Agência\",\"bio\":\"\",\"instagram\":\"\"}")
			.andExpect(jsonPath("$[?(@.slug == 'agencia-brasil-2')]").isNotEmpty());
		String id = ((java.util.List<String>) JsonPath.read(json, "$[?(@.slug == 'agencia-brasil')].id")).getFirst();

		mvc.perform(put("/api/v1/admin/authors/" + id).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Agência Brasil (EBC)\",\"role\":\"Agência\",\"bio\":\"\",\"instagram\":\"nome inválido!\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("instagram"));
		postJson("/api/v1/admin/authors/" + id + "/active", auth, "{\"active\":false}")
			.andExpect(jsonPath("$[?(@.slug == 'agencia-brasil')].active").value(hasItem(false)));

		mvc.perform(get("/api/v1/admin/authors").header("Authorization", TestSessions.bearer(jdbc, REPORTER)))
			.andExpect(status().isForbidden());
	}

}
