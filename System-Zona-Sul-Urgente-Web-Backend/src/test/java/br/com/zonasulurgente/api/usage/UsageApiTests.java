package br.com.zonasulurgente.api.usage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

import br.com.zonasulurgente.api.TestSessions;
import br.com.zonasulurgente.api.TestcontainersConfiguration;

/**
 * Spec 004, Histórias 1, 2 e 4: tela de uso (números da Cloudflare falsa e da conta do sistema), leitura que falha,
 * limite de atualização manual, permissões, avisos de 70/90% uma vez por mudança e limites vindos da configuração.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class UsageApiTests {

	static final String ADMIN = "juliana.prado@zonasulurgente.com.br";
	static final String EDITOR = "rafael.duarte@zonasulurgente.com.br";
	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";

	static final FakeCloudflareGraphql CLOUD = new FakeCloudflareGraphql();

	@DynamicPropertySource
	static void config(DynamicPropertyRegistry registry) {
		registry.add("zsu.usage.cloudflare.graphql-url", CLOUD::url);
		registry.add("zsu.usage.cloudflare.account-id", () -> FakeCloudflareGraphql.ACCOUNT);
		registry.add("zsu.usage.cloudflare.api-token", () -> FakeCloudflareGraphql.TOKEN);
		// Limite pequeno para os números do teste (FR-013: vem da configuração).
		registry.add("zsu.usage.resources[fotos.espaco].limit", () -> "10000");
		// Recurso da IA sem limite configurado (análise G1): aparece em vermelho, não some.
		registry.add("zsu.usage.resources[ia.principal.dia].label", () -> "IA principal — pedidos no dia");
		registry.add("zsu.usage.resources[ia.principal.dia].unit", () -> "REQUESTS");
		registry.add("zsu.usage.resources[ia.principal.dia].period", () -> "DAY_PACIFIC");
		registry.add("zsu.usage.resources[ia.principal.dia].lock-at", () -> "100");
		registry.add("zsu.usage.resources[ia.principal.dia].require-limit", () -> "true");
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	@Autowired
	QuotaService quota;

	@BeforeEach
	void reset() {
		CLOUD.reset();
		jdbc.sql("DELETE FROM usage_counters").update();
		jdbc.sql("DELETE FROM usage_state").update();
	}

	private Map<String, Object> resource(String key) throws Exception {
		String json = mvc.perform(get("/api/v1/admin/usage").header("Authorization", TestSessions.bearer(jdbc, ADMIN)))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		List<Map<String, Object>> items = JsonPath.read(json, "$.resources[?(@.key == '" + key + "')]");
		assertThat(items).as("recurso " + key).hasSize(1);
		return items.getFirst();
	}

	private long audits(String action) {
		return jdbc.sql("SELECT count(*) FROM audit_logs WHERE action = :a AND entity_type = 'usage'")
			.param("a", action).query(Long.class).single();
	}

	// ------------------------------------------------------------------ História 1

	@Test
	void showsConfiguredResourcesWithLimitAndSource() throws Exception {
		mvc.perform(get("/api/v1/admin/usage").header("Authorization", TestSessions.bearer(jdbc, ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.warnAt").value(70))
			.andExpect(jsonPath("$.criticalAt").value(90))
			.andExpect(jsonPath("$.resources[*].key").value(org.hamcrest.Matchers.hasItems("fotos.espaco",
					"fotos.gravacoes", "fotos.leituras", "disco", "ia.principal.dia")));

		Map<String, Object> space = resource("fotos.espaco");
		assertThat(space).containsEntry("label", "Fotos — espaço guardado").containsEntry("unit", "BYTES")
			.containsEntry("lockAt", 95).containsEntry("level", "NORMAL").containsEntry("locked", false);
		assertThat(((Number) space.get("limit")).longValue()).isEqualTo(10000);
		assertThat(space.get("resetsAt")).as("espaço não zera").isNull();
		assertThat(resource("fotos.gravacoes").get("resetsAt")).as("mensal zera").isNotNull();
	}

	@Test
	void aiResourceWithoutLimitShowsInRedInsteadOfDisappearing() throws Exception {
		Map<String, Object> ai = resource("ia.principal.dia");
		assertThat(ai.get("limit")).isNull();
		assertThat(ai).containsEntry("level", "CRITICAL").containsEntry("locked", true);
		assertThat((String) ai.get("note")).contains("Sem limite configurado");
	}

	@Test
	void refreshReadsTheCloudForTheWholeAccountWithReadOnlyToken() throws Exception {
		CLOUD.storageBytes = 4000;
		CLOUD.otherBucketBytes = 1000;
		CLOUD.putObjects = 30;
		CLOUD.getObjects = 500;

		quota.refresh();

		assertThat(CLOUD.lastAuthorization).isEqualTo("Bearer " + FakeCloudflareGraphql.TOKEN);
		Map<String, Object> space = resource("fotos.espaco");
		assertThat(((Number) space.get("used")).longValue()).as("soma dos buckets, leitura mais nova").isEqualTo(5000);
		assertThat(space).containsEntry("source", "cloud").containsEntry("stale", false);
		assertThat(((Number) space.get("percent")).doubleValue()).isEqualTo(50.0);
		assertThat(space.get("readAt")).isNotNull();
		assertThat(((Number) resource("fotos.gravacoes").get("used")).longValue()).as("Classe A").isEqualTo(30);
		assertThat(((Number) resource("fotos.leituras").get("used")).longValue()).as("Classe B").isEqualTo(500);

		Map<String, Object> disk = resource("disco");
		assertThat(((Number) disk.get("used")).longValue()).isPositive();
		assertThat(((Number) disk.get("limit")).longValue()).isGreaterThan(((Number) disk.get("used")).longValue());
	}

	@Test
	void failedReadingKeepsTheLastNumberAndMarksItStale() throws Exception {
		CLOUD.storageBytes = 3000;
		quota.refresh();
		CLOUD.fail = true;

		quota.refresh();

		Map<String, Object> space = resource("fotos.espaco");
		assertThat(((Number) space.get("used")).longValue()).as("nunca número inventado").isEqualTo(3000);
		assertThat(space).containsEntry("stale", true);
		assertThat(jdbc.sql("SELECT cloud_error FROM usage_state WHERE resource = 'fotos.espaco'").query(String.class)
			.single()).contains("503");
	}

	@Test
	void systemCountCoversTheCloudDelayAndOtherUsesAreOnlyInformation() throws Exception {
		CLOUD.storageBytes = 1000;
		quota.refresh();
		quota.record("fotos.espaco", 2500);

		Map<String, Object> space = resource("fotos.espaco");
		assertThat(((Number) space.get("used")).longValue()).as("nuvem + gravado depois da leitura").isEqualTo(3500);

		CLOUD.otherBucketBytes = 6000;
		quota.refresh();
		Map<String, Object> after = resource("fotos.espaco");
		assertThat(((Number) after.get("used")).longValue()).isEqualTo(7000);
		assertThat((String) after.get("note")).as("U2: outros usos da conta").contains("outros usos");
	}

	@Test
	void manualRefreshAtMostOncePerMinute() throws Exception {
		String admin = TestSessions.bearer(jdbc, ADMIN);
		mvc.perform(post("/api/v1/admin/usage/refresh").header("Authorization", admin));
		mvc.perform(post("/api/v1/admin/usage/refresh").header("Authorization", admin))
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.retryAfterSeconds").isNumber());
	}

	@Test
	void onlyTheAdministratorSeesUsage() throws Exception {
		for (String who : List.of(EDITOR, REPORTER)) {
			mvc.perform(get("/api/v1/admin/usage").header("Authorization", TestSessions.bearer(jdbc, who)))
				.andExpect(status().isForbidden());
			mvc.perform(get("/api/v1/admin/usage/alerts").header("Authorization", TestSessions.bearer(jdbc, who)))
				.andExpect(status().isForbidden());
		}
	}

	// ------------------------------------------------------------------ História 2

	@Test
	void levelChangesAreAuditedOncePerChange() throws Exception {
		quota.record("fotos.espaco", 7100);
		assertThat(resource("fotos.espaco")).containsEntry("level", "WARN");
		assertThat(audits("USAGE_LEVEL")).isEqualTo(1);

		quota.record("fotos.espaco", 100);
		assertThat(audits("USAGE_LEVEL")).as("mesmo nível não repete").isEqualTo(1);

		quota.record("fotos.espaco", 1900);
		assertThat(resource("fotos.espaco")).containsEntry("level", "CRITICAL").containsEntry("locked", false);
		assertThat(audits("USAGE_LEVEL")).isEqualTo(2);

		quota.record("fotos.espaco", 500);
		assertThat(resource("fotos.espaco")).containsEntry("locked", true);
		assertThat(audits("USAGE_LOCK")).isEqualTo(1);
		Map<String, Object> details = jdbc.sql("""
				SELECT details::text AS d FROM audit_logs WHERE action = 'USAGE_LOCK' AND entity_id = 'fotos.espaco'""")
			.query().singleRow();
		assertThat((String) details.get("d")).contains("\"used\"", "\"limit\"", "\"percent\"");

		mvc.perform(get("/api/v1/admin/usage/alerts").header("Authorization", TestSessions.bearer(jdbc, ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.key == 'fotos.espaco')].locked").value(org.hamcrest.Matchers.contains(true)));
	}

	@Test
	void goingBackBelowTheLimitUnlocksAndClearsTheAlert() throws Exception {
		quota.record("fotos.espaco", 9600);
		assertThat(resource("fotos.espaco")).containsEntry("locked", true);

		// Fotos apagadas na nuvem: a próxima leitura traz o número menor e a conta do sistema volta a ele.
		jdbc.sql("DELETE FROM usage_counters WHERE resource LIKE 'fotos.espaco%'").update();
		CLOUD.storageBytes = 2000;
		quota.refresh();

		assertThat(resource("fotos.espaco")).containsEntry("level", "NORMAL").containsEntry("locked", false);
		assertThat(audits("USAGE_UNLOCK")).isEqualTo(1);
	}

}
