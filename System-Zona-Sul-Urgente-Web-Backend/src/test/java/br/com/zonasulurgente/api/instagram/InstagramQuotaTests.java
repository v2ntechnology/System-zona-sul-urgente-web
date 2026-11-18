package br.com.zonasulurgente.api.instagram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;

import br.com.zonasulurgente.api.TestSessions;
import br.com.zonasulurgente.api.TestcontainersConfiguration;
import br.com.zonasulurgente.api.ai.AiDraft;
import br.com.zonasulurgente.api.ai.EditorialAiProvider;
import br.com.zonasulurgente.api.ai.EditorialContext;
import br.com.zonasulurgente.api.ai.SourcePost;
import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.jobs.JobWorker;
import br.com.zonasulurgente.api.usage.QuotaGuard;

/**
 * Spec 004, História 3 no Instagram: com o espaço das fotos travado, o post entra sem foto, "Aguardando espaço", o
 * rascunho sai e a foto chega sozinha quando a trava desliga (inclusive a regressão C1: a recusa da trava não pode cair
 * no "imagem indisponível"). Com a cota da IA esgotada, o rascunho espera ("Aguardando a IA"), sem "Erro" e sem gastar
 * tentativa; "Gerar agora" responde 429 com a hora prevista e agenda a geração.
 */
@Import({ TestcontainersConfiguration.class, InstagramQuotaTests.QuotaAi.class })
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class InstagramQuotaTests {

	static final String ADMIN = "juliana.prado@zonasulurgente.com.br";
	static final FakeGraphServer META = new FakeGraphServer();
	static final long LIMIT = 100_000_000L;
	static final Path MEDIA_DIR;

	static {
		try {
			MEDIA_DIR = Files.createTempDirectory("zsu-instagram-quota-test");
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	/** IA falsa que passa pela cota "ia.teste.dia" (limite 2 por dia), como o Gemini faz com as dele. */
	@TestConfiguration(proxyBeanMethods = false)
	static class QuotaAi {

		@Bean
		@Primary
		EditorialAiProvider quotaAi(@Qualifier("fakeEditorialAi") EditorialAiProvider fake, QuotaGuard quota) {
			return new EditorialAiProvider() {
				@Override
				public String name() {
					return fake.name();
				}

				@Override
				public AiDraft draftFromPost(SourcePost post, EditorialContext context) {
					quota.check("ia.teste.dia", 1);
					quota.record("ia.teste.dia", 1);
					return fake.draftFromPost(post, context);
				}
			};
		}

	}

	@DynamicPropertySource
	static void config(DynamicPropertyRegistry registry) {
		registry.add("zsu.instagram.graph-base-url", META::baseUrl);
		registry.add("zsu.media.local-dir", MEDIA_DIR::toString);
		registry.add("zsu.usage.resources[fotos.espaco].limit", () -> String.valueOf(LIMIT));
		registry.add("zsu.usage.resources[ia.teste.dia].label", () -> "IA de teste — pedidos no dia");
		registry.add("zsu.usage.resources[ia.teste.dia].unit", () -> "REQUESTS");
		registry.add("zsu.usage.resources[ia.teste.dia].limit", () -> "2");
		registry.add("zsu.usage.resources[ia.teste.dia].period", () -> "DAY_PACIFIC");
		registry.add("zsu.usage.resources[ia.teste.dia].lock-at", () -> "100");
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	@Autowired
	InstagramSyncService sync;

	@Autowired
	InstagramConnectionService connections;

	@Autowired
	JobWorker worker;

	@Autowired
	QuotaGuard quota;

	private final OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC).withNano(0);

	@BeforeEach
	void connect() {
		META.reset();
		jdbc.sql("DELETE FROM usage_counters").update();
		jdbc.sql("DELETE FROM usage_state").update();
		UUID admin = jdbc.sql("SELECT id FROM users WHERE email = :e").param("e", ADMIN).query(UUID.class).single();
		connections.connect(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN,
				new AuthenticatedUser(admin, "Juliana Prado", ADMIN, "ADMIN", List.of("instagram.settings"), null, null));
	}

	private void runJobs() {
		var request = RequestContextHolder.getRequestAttributes();
		RequestContextHolder.resetRequestAttributes();
		try {
			for (int n = worker.runOnce(); n > 0; n = worker.runOnce()) {
				// roda até esvaziar o que está pronto
			}
		}
		finally {
			RequestContextHolder.setRequestAttributes(request);
		}
	}

	private Map<String, Object> row(String id) {
		return jdbc.sql("SELECT * FROM instagram_posts WHERE id = :id").param("id", id).query().singleRow();
	}

	private Map<String, Object> job(String id, String flag) {
		return jdbc.sql("""
				SELECT status, attempts, run_at > now() AS later, last_error FROM job_queue
				WHERE type = 'INSTAGRAM_IMPORT' AND payload->>'postId' = :id AND payload->>:flag IS NOT NULL""")
			.param("id", id)
			.param("flag", flag)
			.query()
			.singleRow();
	}

	private static String caption(String first) {
		return first + ". A Defesa Civil acompanha a situação.\n\nMais informações em breve.";
	}

	@Test
	void lockedSpaceKeepsThePostWaitingAndThePhotoArrivesLater() {
		quota.record("fotos.espaco", LIMIT * 96 / 100);
		META.photo("3001", caption("Árvore cai em Botafogo"), now.minusHours(1));
		sync.sync();

		runJobs();

		Map<String, Object> post = row("3001");
		assertThat(post).as("rascunho sai mesmo sem foto").containsEntry("status", "IMPORTED")
			.containsEntry("waiting", "SPACE");
		assertThat(post.get("main_media_id")).as("C1: não perdeu nem guardou a foto").isNull();
		UUID newsId = (UUID) post.get("news_id");
		assertThat(jdbc.sql("SELECT image_id FROM news WHERE id = :id").param("id", newsId).query().singleRow()
			.get("image_id")).isNull();
		Map<String, Object> retry = job("3001", "photoRetry");
		assertThat(retry).containsEntry("status", "PENDING").containsEntry("later", true);

		// Trava desligou (fotos apagadas na nuvem): o job da foto roda e a foto vira a principal do rascunho.
		jdbc.sql("DELETE FROM usage_counters WHERE resource LIKE 'fotos.espaco%'").update();
		jdbc.sql("UPDATE job_queue SET run_at = now() WHERE payload->>'photoRetry' IS NOT NULL").update();
		runJobs();

		Map<String, Object> after = row("3001");
		assertThat(after.get("waiting")).isNull();
		assertThat(after.get("main_media_id")).isNotNull();
		Map<String, Object> news = jdbc.sql("""
				SELECT m.credit FROM news n JOIN media_assets m ON m.id = n.image_id WHERE n.id = :id""")
			.param("id", newsId).query().singleRow();
		assertThat((String) news.get("credit")).startsWith("Foto: Reprodução/Instagram");
	}

	@Test
	void photoRetryStillLockedWaitsAgainWithoutSpendingAnAttempt() {
		quota.record("fotos.espaco", LIMIT * 96 / 100);
		META.photo("3002", caption("Obra na orla"), now.minusHours(1));
		sync.sync();
		runJobs();

		jdbc.sql("UPDATE job_queue SET run_at = now() WHERE payload->>'photoRetry' IS NOT NULL").update();
		runJobs();

		Map<String, Object> retry = job("3002", "photoRetry");
		assertThat(retry).containsEntry("status", "PENDING").containsEntry("later", true);
		assertThat(((Number) retry.get("attempts")).intValue()).isZero();
		assertThat((String) retry.get("last_error")).startsWith("Aguardando:");
		assertThat(row("3002")).containsEntry("waiting", "SPACE");
	}

	@Test
	void aiQuotaReachedLeavesThePostWaitingNeverInError() {
		quota.record("ia.teste.dia", 2);
		META.photo("3003", caption("Feira em Copacabana"), now.minusHours(1));
		sync.sync();

		runJobs();

		Map<String, Object> post = row("3003");
		assertThat(post).containsEntry("status", "NEW").containsEntry("waiting", "AI");
		assertThat(post.get("news_id")).isNull();
		assertThat(post.get("waiting_until")).isNotNull();
		Map<String, Object> import_ = jdbc.sql("""
				SELECT status, attempts, run_at > now() AS later FROM job_queue
				WHERE type = 'INSTAGRAM_IMPORT' AND payload->>'postId' = '3003'""").query().singleRow();
		assertThat(import_).containsEntry("status", "PENDING").containsEntry("later", true);
		assertThat(((Number) import_.get("attempts")).intValue()).as("adiado sem gastar tentativa").isZero();

		// Dia novo na cota (contador zerado): o rascunho sai sozinho.
		jdbc.sql("DELETE FROM usage_counters WHERE resource LIKE 'ia.teste.dia%'").update();
		jdbc.sql("UPDATE job_queue SET run_at = now() WHERE payload->>'postId' = '3003'").update();
		runJobs();

		Map<String, Object> after = row("3003");
		assertThat(after).containsEntry("status", "IMPORTED");
		assertThat(after.get("waiting")).isNull();
	}

	@Test
	void generateNowWithAiQuotaReachedAnswers429AndSchedulesTheDraft() throws Exception {
		quota.record("ia.teste.dia", 2);
		String admin = TestSessions.bearer(jdbc, ADMIN);
		mvc.perform(post("/api/v1/admin/instagram/posts").header("Authorization", admin)
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"url": "https://www.instagram.com/p/QUOTA123/", "caption": "Ciclovia interditada na Lagoa."}"""))
			.andExpect(status().isCreated());

		mvc.perform(post("/api/v1/admin/instagram/posts/QUOTA123/generate").header("Authorization", admin))
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.title").value("Limite da IA"))
			.andExpect(jsonPath("$.retryAt").isString());

		assertThat(row("QUOTA123")).containsEntry("status", "NEW").containsEntry("waiting", "AI");
		assertThat(job("QUOTA123", "generate")).containsEntry("status", "PENDING").containsEntry("later", true);

		jdbc.sql("DELETE FROM usage_counters WHERE resource LIKE 'ia.teste.dia%'").update();
		jdbc.sql("UPDATE job_queue SET run_at = now() WHERE payload->>'generate' IS NOT NULL").update();
		runJobs();
		assertThat(row("QUOTA123")).containsEntry("status", "IMPORTED");
	}

}
