package br.com.zonasulurgente.api.instagram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.TestSessions;
import br.com.zonasulurgente.api.TestcontainersConfiguration;

/**
 * Spec 001, História 1: ligar, trocar e desligar a conta do Instagram (só Administrador), ver a situação (quem revisa
 * a fila) e nunca expor o acesso. A Meta é um servidor local ({@link FakeGraphServer}).
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class InstagramConnectionApiTests {

	static final String ADMIN = "juliana.prado@zonasulurgente.com.br";
	static final String EDITOR = "rafael.duarte@zonasulurgente.com.br";
	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";
	static final String URL = "/api/v1/admin/instagram/connection";

	static final FakeGraphServer META = new FakeGraphServer();

	@DynamicPropertySource
	static void meta(DynamicPropertyRegistry registry) {
		registry.add("zsu.instagram.graph-base-url", META::baseUrl);
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	@BeforeEach
	void resetMeta() {
		META.reset();
	}

	private ResultActions connect(String auth, String igUserId, String token) throws Exception {
		return mvc.perform(put(URL).header("Authorization", auth)
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"igUserId":"%s","accessToken":"%s"}""".formatted(igUserId, token)));
	}

	@Test
	void adminConnectsAndEveryoneWhoReviewsSeesTheStatus() throws Exception {
		String admin = TestSessions.bearer(jdbc, ADMIN);
		mvc.perform(get(URL).header("Authorization", admin)).andExpect(status().isNotFound());

		connect(admin, FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.username").value(FakeGraphServer.USERNAME))
			.andExpect(jsonPath("$.igUserId").value(FakeGraphServer.ACCOUNT_ID))
			.andExpect(jsonPath("$.status").value("ACTIVE"))
			.andExpect(jsonPath("$.connectedBy").value("Juliana Prado"))
			.andExpect(jsonPath("$.tokenLast4").value(FakeGraphServer.TOKEN.substring(FakeGraphServer.TOKEN.length() - 4)))
			.andExpect(jsonPath("$.tokenExpiresAt").doesNotExist())
			.andExpect(jsonPath("$.pollMinutes").value(15))
			.andExpect(jsonPath("$.alert").doesNotExist());

		mvc.perform(get(URL).header("Authorization", TestSessions.bearer(jdbc, REPORTER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.username").value(FakeGraphServer.USERNAME));
		mvc.perform(get(URL).header("Authorization", TestSessions.bearer(jdbc, EDITOR))).andExpect(status().isOk());
	}

	@Test
	void onlyAdminChangesTheConnection() throws Exception {
		for (String email : new String[] { EDITOR, REPORTER }) {
			String auth = TestSessions.bearer(jdbc, email);
			connect(auth, FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN).andExpect(status().isForbidden());
			mvc.perform(delete(URL).header("Authorization", auth)).andExpect(status().isForbidden());
		}
		assertThat(jdbc.sql("SELECT count(*) FROM instagram_connection").query(Long.class).single()).isZero();
	}

	@Test
	void rejectedAccessOrAccountIsNotSaved() throws Exception {
		String admin = TestSessions.bearer(jdbc, ADMIN);

		// Acesso que a Meta não aceita (inclusive de conta pessoal ou fora do portfólio).
		connect(admin, FakeGraphServer.ACCOUNT_ID, "EAAacessoerradoqualquer123")
			.andExpect(status().isUnprocessableContent())
			.andExpect(jsonPath("$.title").value("Não foi possível ligar a conta"));
		// ID de outra conta.
		connect(admin, "17841499999999999", FakeGraphServer.TOKEN).andExpect(status().isUnprocessableContent());
		// Meta fora do ar.
		META.failWith(503, 2);
		connect(admin, FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN).andExpect(status().isServiceUnavailable());
		META.failWith(0, 0);
		// Campos inválidos nem chegam à Meta.
		int calls = META.paths().size();
		connect(admin, "abc", "").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("accessToken"))
			.andExpect(jsonPath("$.errors[1].field").value("igUserId"));
		assertThat(META.paths()).hasSize(calls);

		assertThat(jdbc.sql("SELECT count(*) FROM instagram_connection").query(Long.class).single()).isZero();
	}

	@Test
	void accessNeverLeavesTheApi() throws Exception {
		String admin = TestSessions.bearer(jdbc, ADMIN);

		String body = connect(admin, FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN).andReturn()
			.getResponse().getContentAsString();
		String status = mvc.perform(get(URL).header("Authorization", admin)).andReturn().getResponse()
			.getContentAsString();
		connect(admin, FakeGraphServer.ACCOUNT_ID, "EAAacessoerradoqualquer123");

		assertThat(body).doesNotContain(FakeGraphServer.TOKEN);
		assertThat(status).doesNotContain(FakeGraphServer.TOKEN);
		assertThat(jdbc.sql("SELECT token_cipher FROM instagram_connection").query(String.class).single())
			.doesNotContain(FakeGraphServer.TOKEN);
		assertThat(jdbc.sql("SELECT count(*) FROM audit_logs WHERE diff::text LIKE '%EAA%' OR details::text LIKE '%EAA%'")
			.query(Long.class)
			.single()).isZero();
	}

	@Test
	void switchingAndDisconnectingAreAuditedAndKeepTheQueue() throws Exception {
		String admin = TestSessions.bearer(jdbc, ADMIN);
		jdbc.sql("""
				INSERT INTO instagram_posts (id, caption, permalink, posted_at, source)
				VALUES ('CManual1', 'Post da conta antiga', 'https://www.instagram.com/p/CManual1/', now(), 'MANUAL')""")
			.update();

		connect(admin, FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN).andExpect(status().isOk());
		connect(admin, FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN).andExpect(status().isOk());
		mvc.perform(delete(URL).header("Authorization", admin)).andExpect(status().isNoContent());
		mvc.perform(get(URL).header("Authorization", admin)).andExpect(status().isNotFound());

		assertThat(jdbc.sql("""
				SELECT action FROM audit_logs WHERE entity_type = 'instagram_connection' ORDER BY occurred_at, id""")
			.query(String.class)
			.list()).containsExactly("INSTAGRAM_CONNECT", "INSTAGRAM_CONNECT", "INSTAGRAM_DISCONNECT");
		assertThat(jdbc.sql("SELECT count(*) FROM instagram_posts WHERE id = 'CManual1'").query(Long.class).single())
			.isOne();
	}

}
