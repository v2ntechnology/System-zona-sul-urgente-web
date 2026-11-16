package br.com.zonasulurgente.api.instagram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.web.context.request.RequestContextHolder;

import br.com.zonasulurgente.api.TestSessions;
import br.com.zonasulurgente.api.TestcontainersConfiguration;
import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.jobs.JobWorker;

/**
 * Spec 001: sincronização com a conta (História 2 — posts novos com foto viram rascunho; História 3 — legenda
 * alterada e post apagado; História 4 — acesso perdido e falhas seguidas). A Meta é um servidor local; a IA é a falsa
 * (zsu.ai.provider=fake); a fila de jobs roda à mão ({@link JobWorker#runOnce()}).
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class InstagramSyncTests {

	static final String ADMIN = "juliana.prado@zonasulurgente.com.br";
	static final String EDITOR = "rafael.duarte@zonasulurgente.com.br";
	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";
	static final String CREDIT = "Foto: Reprodução/Instagram @" + FakeGraphServer.USERNAME;
	static final FakeGraphServer META = new FakeGraphServer();
	static final Path MEDIA_DIR;

	static {
		try {
			MEDIA_DIR = Files.createTempDirectory("zsu-instagram-test");
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	@DynamicPropertySource
	static void config(DynamicPropertyRegistry registry) {
		registry.add("zsu.instagram.graph-base-url", META::baseUrl);
		registry.add("zsu.media.local-dir", MEDIA_DIR::toString);
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
	InstagramQueueService queue;

	@Autowired
	JobWorker worker;

	private final OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC).withNano(0);

	static String caption(String first) {
		return first + ". A Defesa Civil acompanha a situação.\n\nMais informações em breve. #zonasul @defesacivilrj";
	}

	@BeforeEach
	void connect() {
		META.reset();
		UUID admin = jdbc.sql("SELECT id FROM users WHERE email = :e").param("e", ADMIN).query(UUID.class).single();
		connections.connect(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN,
				new AuthenticatedUser(admin, "Juliana Prado", ADMIN, "ADMIN", List.of("instagram.settings"), null, null));
	}

	/** Roda os jobs fora de requisição, como o worker de verdade (a origem da auditoria sai SYSTEM). */
	private int runJobs() {
		var request = RequestContextHolder.getRequestAttributes();
		RequestContextHolder.resetRequestAttributes();
		try {
			int total = 0;
			for (int n = worker.runOnce(); n > 0; n = worker.runOnce()) {
				total += n;
			}
			return total;
		}
		finally {
			RequestContextHolder.setRequestAttributes(request);
		}
	}

	private Map<String, Object> row(String id) {
		return jdbc.sql("SELECT * FROM instagram_posts WHERE id = :id").param("id", id).query().singleRow();
	}

	private long count(String sql) {
		return jdbc.sql(sql).query(Long.class).single();
	}

	// ------------------------------------------------------------------ História 2

	@Test
	void firstSyncBringsOnlyTheLastSevenDays() {
		META.photo("1001", caption("Árvore cai em Botafogo"), now.minusHours(2));
		META.reel("1002", caption("Alagamento em Copacabana"), now.minusDays(6), true, true);
		META.photo("1003", caption("Post antigo"), now.minusDays(8));

		var result = sync.sync().orElseThrow();

		assertThat(result.added()).isEqualTo(2);
		assertThat(jdbc.sql("SELECT id FROM instagram_posts WHERE source = 'API' ORDER BY id").query(String.class).list())
			.containsExactly("1001", "1002");
		assertThat(row("1001")).containsEntry("status", "NEW")
			.containsEntry("ig_media_id", "1001")
			.containsEntry("ig_user_id", FakeGraphServer.ACCOUNT_ID)
			.containsEntry("permalink", FakeGraphServer.permalink("1001"));
		assertThat(count("SELECT count(*) FROM job_queue WHERE type = 'INSTAGRAM_IMPORT'")).isEqualTo(2);

		assertThat(sync.sync().orElseThrow().added()).as("segunda varredura sem novidade").isZero();
		assertThat(count("SELECT count(*) FROM instagram_posts WHERE source = 'API'")).isEqualTo(2);
		assertThat(count("SELECT count(*) FROM job_queue WHERE type = 'INSTAGRAM_IMPORT'")).isEqualTo(2);
	}

	@Test
	void manyPostsAcrossPagesAreAllImportedOnce() {
		for (int i = 0; i < 30; i++) {
			META.photo(String.valueOf(2000 + i), caption("Post " + i), now.minusHours(i + 1));
		}

		assertThat(sync.sync().orElseThrow().added()).isEqualTo(30);
		assertThat(META.mediaListCalls()).isEqualTo(2);
		assertThat(count("SELECT count(DISTINCT id) FROM instagram_posts WHERE source = 'API'")).isEqualTo(30);
	}

	@Test
	void syncedPhotoBecomesADraftWithPhotoCreditAndAltText() {
		META.photo("1001", caption("Árvore cai em Botafogo"), now.minusHours(2));
		sync.sync();

		runJobs();

		Map<String, Object> row = row("1001");
		assertThat(row).containsEntry("status", "IMPORTED").containsEntry("needs_photo", false);
		assertThat(row.get("main_media_id")).isNotNull();
		UUID newsId = (UUID) row.get("news_id");
		assertThat(newsId).isNotNull();
		Map<String, Object> news = jdbc.sql("""
				SELECT n.status, n.origin, n.created_by, m.credit, m.alt, m.url FROM news n
				JOIN media_assets m ON m.id = n.image_id WHERE n.id = :id""").param("id", newsId).query().singleRow();
		assertThat(news).containsEntry("status", "DRAFT").containsEntry("origin", "INSTAGRAM");
		assertThat(news.get("created_by")).isNull();
		assertThat(news).containsEntry("credit", CREDIT).containsEntry("alt", "Descrição da foto 1001");
		assertThat(count("""
				SELECT count(*) FROM audit_logs WHERE action = 'AI_GENERATION' AND origin = 'SYSTEM'
				AND actor_name = 'Sincronização do Instagram'""")).isOne();

		assertThat(runJobs()).as("nada mais a fazer").isZero();
		assertThat(count("SELECT count(*) FROM instagram_posts WHERE news_id IS NOT NULL")).as("uma notícia só").isOne();
	}

	@Test
	void carouselKeepsEveryImageInOrderAndReelUsesTheCover() {
		META.carousel("3001", caption("Feira na praça"), now.minusHours(1), List.of("IMAGE", "VIDEO", "IMAGE"));
		META.reel("3002", caption("Ressaca no Arpoador"), now.minusHours(2), true, true);
		sync.sync();

		runJobs();

		assertThat(jdbc.sql("SELECT kind FROM instagram_post_media WHERE post_id = '3001' ORDER BY position")
			.query(String.class).list()).containsExactly("IMAGE", "VIDEO_COVER", "IMAGE");
		assertThat(jdbc.sql("SELECT kind FROM instagram_post_media WHERE post_id = '3002'").query(String.class).list())
			.containsExactly("VIDEO_COVER");
		assertThat(row("3001").get("media_count")).isEqualTo(3);
		assertThat(queue.list(null)).filteredOn(p -> p.id().equals("3001")).singleElement()
			.satisfies(p -> {
				assertThat(p.source()).isEqualTo("API");
				assertThat(p.mediaUrls()).hasSize(3);
				assertThat(p.thumbnailUrl()).isEqualTo(p.mediaUrls().getFirst());
			});
	}

	@Test
	void videoWithoutFileNorCoverNeedsAPhoto() {
		META.reel("4001", caption("Show na orla"), now.minusHours(1), false, false);
		sync.sync();

		runJobs();

		assertThat(row("4001")).containsEntry("needs_photo", true).containsEntry("status", "IMPORTED");
		assertThat(row("4001").get("main_media_id")).isNull();
	}

	@Test
	void manualPostFoundBySyncGetsTheMediaButNoAutomaticDraft() {
		jdbc.sql("""
				INSERT INTO instagram_posts (id, caption, permalink, posted_at, source)
				VALUES ('C5001', :caption, :permalink, now(), 'MANUAL')""")
			.param("caption", caption("Colado à mão"))
			.param("permalink", FakeGraphServer.permalink("5001"))
			.update();
		META.photo("5001", caption("Colado à mão"), now.minusHours(1));

		var result = sync.sync().orElseThrow();
		runJobs();

		assertThat(result.added()).isZero();
		assertThat(result.linked()).isOne();
		assertThat(count("SELECT count(*) FROM instagram_posts")).as("um item só na fila").isOne();
		Map<String, Object> row = row("C5001");
		assertThat(row).containsEntry("source", "MANUAL")
			.containsEntry("ig_media_id", "5001")
			.containsEntry("status", "NEW");
		assertThat(row.get("main_media_id")).isNotNull();
		assertThat(row.get("news_id")).as("manual só gera com 'Gerar agora'").isNull();
	}

	@Test
	void aiFailureIsAnErrorThatCanBeReprocessed() {
		META.photo("6001", "#zonasul #riodejaneiro", now.minusHours(1));
		sync.sync();

		runJobs();

		assertThat(row("6001")).containsEntry("status", "ERROR");
		assertThat(row("6001").get("main_media_id")).as("a mídia já foi guardada").isNotNull();
		assertThat(count("SELECT count(*) FROM job_queue WHERE type = 'INSTAGRAM_IMPORT' AND status = 'DEAD'"))
			.as("erro da IA não é falha do job").isZero();
	}

	@Test
	void withoutAConnectionNothingIsFetched() throws Exception {
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
			.delete("/api/v1/admin/instagram/connection")
			.header("Authorization", TestSessions.bearer(jdbc, ADMIN))).andExpect(status().isNoContent());
		int calls = META.paths().size();

		assertThat(sync.sync()).isEmpty();
		assertThat(META.paths()).hasSize(calls);
	}

	@Test
	void syncNowIsOnlyForAdminAndConnectingRunsTheFirstSync() throws Exception {
		META.photo("7001", caption("Post da última semana"), now.minusDays(1));
		String url = "/api/v1/admin/instagram/connection/sync";
		for (String email : new String[] { EDITOR, REPORTER }) {
			mvc.perform(post(url).header("Authorization", TestSessions.bearer(jdbc, email)))
				.andExpect(status().isForbidden());
		}
		String admin = TestSessions.bearer(jdbc, ADMIN);

		mvc.perform(post(url).header("Authorization", admin)).andExpect(status().isAccepted());
		assertThat(count("SELECT count(*) FROM instagram_posts WHERE id = '7001'")).isOne();

		jdbc.sql("DELETE FROM instagram_posts").update();
		mvc.perform(put("/api/v1/admin/instagram/connection").header("Authorization", admin)
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"igUserId":"%s","accessToken":"%s"}""".formatted(FakeGraphServer.ACCOUNT_ID, FakeGraphServer.TOKEN)))
			.andExpect(status().isOk());
		assertThat(count("SELECT count(*) FROM instagram_posts WHERE id = '7001'")).as("ligar já sincroniza").isOne();

		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
			.delete("/api/v1/admin/instagram/connection").header("Authorization", admin));
		mvc.perform(post(url).header("Authorization", admin)).andExpect(status().isConflict());
	}

	// ------------------------------------------------------------------ História 3

	/** Post da conta já importado e com notícia. */
	private UUID imported(String id, String caption) {
		META.photo(id, caption, now.minusHours(3));
		sync.sync();
		runJobs();
		assertThat(row(id)).containsEntry("status", "IMPORTED");
		return (UUID) row(id).get("news_id");
	}

	private String newsTitle(UUID id) {
		return jdbc.sql("SELECT title || '|' || status FROM news WHERE id = :id").param("id", id).query(String.class)
			.single();
	}

	@Test
	void editedCaptionIsFlaggedAndTheNewsStaysTheSame() {
		String original = caption("Árvore cai em Botafogo");
		UUID news = imported("8001", original);
		String before = newsTitle(news);
		String edited = caption("Árvore cai em Botafogo e interdita a rua");

		META.editCaption("8001", edited);
		assertThat(sync.sync().orElseThrow().changed()).isOne();

		assertThat(row("8001")).containsEntry("status", "CHANGED_AT_SOURCE")
			.containsEntry("caption", original)
			.containsEntry("current_caption", edited);
		assertThat(row("8001").get("source_changed_at")).isNotNull();
		assertThat(newsTitle(news)).isEqualTo(before);

		queue.acknowledge("8001");
		sync.sync();
		assertThat(row("8001")).as("revisado: só volta a avisar numa mudança nova").containsEntry("status", "IMPORTED");

		META.editCaption("8001", caption("Terceira versão da legenda"));
		sync.sync();
		assertThat(row("8001")).containsEntry("status", "CHANGED_AT_SOURCE");
	}

	@Test
	void deletedPostIsFlaggedAsRemovedAndTheNewsStaysTheSame() {
		UUID news = imported("8101", caption("Show na orla"));
		String before = newsTitle(news);

		META.delete("8101");
		assertThat(sync.sync().orElseThrow().removed()).isOne();

		assertThat(row("8101")).containsEntry("status", "REMOVED_AT_SOURCE");
		assertThat(newsTitle(news)).isEqualTo(before);
	}

	@Test
	void postsOutsideTheWindowAreNotChecked() {
		jdbc.sql("""
				INSERT INTO instagram_posts (id, ig_media_id, ig_user_id, caption, permalink, posted_at, status, source)
				VALUES ('8201', '8201', :account, 'Post de 40 dias', :permalink, now() - interval '40 days',
				  'IMPORTED', 'API')""")
			.param("account", FakeGraphServer.ACCOUNT_ID)
			.param("permalink", FakeGraphServer.permalink("8201"))
			.update();

		sync.sync();

		assertThat(row("8201")).containsEntry("status", "IMPORTED");
		assertThat(META.paths()).doesNotContain("/8201");
	}

	@Test
	void anIncompleteReadNeverMarksPostsAsRemoved() {
		imported("8301", caption("Post importado"));
		for (int i = 0; i < 30; i++) {
			META.photo(String.valueOf(8400 + i), caption("Post " + i), now.minusMinutes(i + 1));
		}
		META.delete("8301");
		META.failNextPages(503, 2);

		sync.sync();

		assertThat(row("8301")).as("a segunda página falhou: não dá para saber se sumiu").containsEntry("status", "IMPORTED");
		assertThat(jdbc.sql("SELECT failures FROM instagram_connection").query(Integer.class).single()).isOne();
	}

	// ------------------------------------------------------------------ História 4

	@Test
	void revokedAccessStopsTheSyncAndWarnsOnce() throws Exception {
		META.failWith(400, 190);

		sync.sync();
		sync.sync();

		assertThat(jdbc.sql("SELECT status FROM instagram_connection").query(String.class).single()).isEqualTo("REVOKED");
		assertThat(count("SELECT count(*) FROM audit_logs WHERE action = 'INSTAGRAM_ACCESS_LOST'")).isOne();
		assertThat(count("SELECT count(*) FROM audit_logs WHERE details::text LIKE '%EAA%' OR diff::text LIKE '%EAA%'"))
			.isZero();
		int calls = META.paths().size();
		assertThat(sync.sync()).as("parada até religar").isEmpty();
		assertThat(META.paths()).hasSize(calls);
		var view = connections.view().orElseThrow();
		assertThat(view.alert().kind()).isEqualTo("REVOKED");
		assertThat(view.lastSuccessAt()).isNull();

		// A importação manual continua funcionando.
		mvc.perform(post("/api/v1/admin/instagram/posts").header("Authorization", TestSessions.bearer(jdbc, REPORTER))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"url":"https://www.instagram.com/p/CManualRevogado/","caption":"Post colado à mão"}"""))
			.andExpect(status().isCreated());

		// Acesso novo: o aviso some.
		META.failWith(0, 0);
		connect();
		assertThat(connections.view().orElseThrow().alert()).isNull();
	}

	@Test
	void transientFailuresOnlyWarnAfterThreeInARow() {
		META.failWith(503, 2);

		sync.sync();
		sync.sync();
		assertThat(connections.view().orElseThrow().alert()).as("2 falhas: ainda sem aviso").isNull();
		sync.sync();
		var failing = connections.view().orElseThrow();
		assertThat(failing.alert().kind()).isEqualTo("FAILING");
		assertThat(failing.status()).isEqualTo("ACTIVE");

		META.failWith(0, 0);
		sync.sync();
		var ok = connections.view().orElseThrow();
		assertThat(ok.alert()).isNull();
		assertThat(ok.lastSuccessAt()).isNotNull();
		assertThat(jdbc.sql("SELECT failures FROM instagram_connection").query(Integer.class).single()).isZero();
	}

	@Test
	void importJobGivesUpQuietlyWhenAccessIsLost() {
		META.photo("8501", caption("Post antes da revogação"), now.minusHours(1));
		sync.sync();
		META.failWith(400, 190);
		jdbc.sql("UPDATE instagram_connection SET status = 'REVOKED'").update();

		runJobs();

		assertThat(count("SELECT count(*) FROM job_queue WHERE type = 'INSTAGRAM_IMPORT' AND status <> 'COMPLETED'"))
			.as("não fica tentando à toa").isZero();
		assertThat(row("8501")).containsEntry("status", "NEW");
	}

}
