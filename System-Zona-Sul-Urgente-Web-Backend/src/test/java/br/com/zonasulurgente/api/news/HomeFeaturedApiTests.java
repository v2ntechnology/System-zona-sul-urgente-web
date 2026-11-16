package br.com.zonasulurgente.api.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.TestSessions;
import br.com.zonasulurgente.api.TestcontainersConfiguration;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Spec 003: destaques da home — montar o topo (H1), saída automática ao sair do ar (H3) e atalhos (H2). Também a
 * manchete automática no endpoint público (T007).
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class HomeFeaturedApiTests {

	static final String ADMIN = "juliana.prado@zonasulurgente.com.br";
	static final String EDITOR = "rafael.duarte@zonasulurgente.com.br";
	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";
	static final String COMERCIAL = "sandra.lopes@zonasulurgente.com.br";
	static final String URL = "/api/v1/admin/home/featured";
	static final JsonMapper JSON = JsonMapper.builder().build();

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	private String admin;
	/** Publicadas não patrocinadas, da mais recente para a mais antiga. */
	private List<UUID> news;
	private UUID sponsored;

	@BeforeEach
	void setUp() {
		admin = TestSessions.bearer(jdbc, ADMIN);
		news = jdbc.sql("""
				SELECT id FROM news WHERE status = 'PUBLISHED' AND deleted_at IS NULL AND NOT is_sponsored
				ORDER BY published_at DESC, id DESC LIMIT 14""").query(UUID.class).list();
		sponsored = jdbc.sql("""
				SELECT id FROM news WHERE status = 'PUBLISHED' AND deleted_at IS NULL AND is_sponsored LIMIT 1""")
			.query(UUID.class).single();
	}

	private JsonNode view(String auth) throws Exception {
		return JSON.readTree(mvc.perform(get(URL).header("Authorization", auth)).andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString());
	}

	private ResultActions save(String auth, List<UUID> ids, String signature) throws Exception {
		List<String> json = new ArrayList<>();
		ids.forEach(id -> json.add(id == null ? "null" : "\"" + id + "\""));
		return mvc.perform(put(URL).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
			.content("{\"ids\":[" + String.join(",", json) + "],\"signature\":\"" + signature + "\"}"));
	}

	private ResultActions setOrder(List<UUID> ids) throws Exception {
		return save(admin, ids, view(admin).path("signature").asString()).andExpect(status().isOk());
	}

	private ResultActions feature(String auth, UUID id, String as) throws Exception {
		return mvc.perform(post("/api/v1/admin/news/" + id + "/feature").header("Authorization", auth)
			.contentType(MediaType.APPLICATION_JSON).content("{\"as\":\"" + as + "\"}"));
	}

	/** Ordem gravada: posição → id (nulo = vazia), até a última ocupada. */
	private List<UUID> order() {
		List<UUID> out = new ArrayList<>();
		for (int i = 0; i < 10; i++) {
			out.add(null);
		}
		jdbc.sql("SELECT featured_rank, id FROM news WHERE featured_rank IS NOT NULL")
			.query((rs, i) -> out.set(rs.getInt(1) - 1, rs.getObject(2, UUID.class)))
			.list();
		while (!out.isEmpty() && out.getLast() == null) {
			out.removeLast();
		}
		return out;
	}

	private long count(String sql) {
		return jdbc.sql(sql).query(Long.class).single();
	}

	private static List<UUID> list(UUID... ids) {
		return new ArrayList<>(java.util.Arrays.asList(ids));
	}

	// ------------------------------------------------------------------ História 1

	@Test
	void editorSeesTenPositionsAndSavesTheWholeOrder() throws Exception {
		String editor = TestSessions.bearer(jdbc, EDITOR);
		JsonNode before = view(editor);
		assertThat(before.path("slots")).hasSize(10);
		assertThat(before.path("signature").asString()).hasSize(16);
		long jobs = count("SELECT count(*) FROM job_queue WHERE type = 'CACHE_INVALIDATE' AND payload::text LIKE '%home%'");

		save(editor, list(news.get(0), news.get(1), news.get(2)), before.path("signature").asString())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.slots[0].news.id").value(news.get(0).toString()))
			.andExpect(jsonPath("$.slots[2].news.id").value(news.get(2).toString()))
			.andExpect(jsonPath("$.slots[3].news").doesNotExist());

		assertThat(order()).containsExactly(news.get(0), news.get(1), news.get(2));
		assertThat(count("SELECT count(*) FROM job_queue WHERE type = 'CACHE_INVALIDATE' AND payload::text LIKE '%home%'"))
			.isEqualTo(jobs + 1);
		assertThat(count("SELECT count(*) FROM audit_logs WHERE action = 'HOME_FEATURE'")).isOne();
	}

	@Test
	void savingOverSomeoneElsesChangeIsAConflict() throws Exception {
		String stale = view(admin).path("signature").asString();
		setOrder(list(news.get(0)));

		save(admin, list(news.get(1)), stale)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.title").value("Os destaques mudaram"))
			.andExpect(jsonPath("$.current.slots[0].news.id").value(news.get(0).toString()));
		assertThat(order()).containsExactly(news.get(0));
	}

	@Test
	void onlyPublishedNonRepeatedAndNoSponsoredHeadline() throws Exception {
		String signature = view(admin).path("signature").asString();
		List<UUID> eleven = new ArrayList<>(news.subList(0, 11));
		save(admin, eleven, signature).andExpect(status().isBadRequest());
		save(admin, list(news.get(0), news.get(0)), signature).andExpect(status().isBadRequest());

		UUID draft = news.get(5);
		jdbc.sql("UPDATE news SET status = 'DRAFT' WHERE id = :id").param("id", draft).update();
		save(admin, list(news.get(0), draft), signature).andExpect(status().isUnprocessableContent());

		save(admin, list(sponsored, news.get(0)), signature)
			.andExpect(status().isUnprocessableContent())
			.andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("patrocinada")));
		save(admin, list(news.get(0), sponsored), signature).andExpect(status().isOk());
		assertThat(order()).containsExactly(news.get(0), sponsored);
	}

	@Test
	void onlyEditorsAndAdminsManageTheTop() throws Exception {
		for (String email : new String[] { REPORTER, COMERCIAL }) {
			String auth = TestSessions.bearer(jdbc, email);
			mvc.perform(get(URL).header("Authorization", auth)).andExpect(status().isForbidden());
			save(auth, list(news.get(0)), "x").andExpect(status().isForbidden());
			feature(auth, news.get(0), "MAIN").andExpect(status().isForbidden());
		}
		view(TestSessions.bearer(jdbc, EDITOR));
	}

	@Test
	void emptyHeadlineIsTheMostRecentNonSponsoredOnThePublicSite() throws Exception {
		jdbc.sql("UPDATE news SET published_at = now() + interval '-1 second' WHERE id = :id").param("id", sponsored)
			.update();
		setOrder(list(null, news.get(3), news.get(4)));

		JsonNode panel = view(admin);
		assertThat(panel.path("slots").get(0).path("news").isNull()).isTrue();
		UUID automatic = UUID.fromString(panel.path("automaticMain").path("id").asString());
		assertThat(automatic).isNotEqualTo(sponsored);

		mvc.perform(get("/api/v1/public/news/featured"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.mainAutomatic").value(true))
			.andExpect(jsonPath("$.main.id").value(automatic.toString()))
			.andExpect(jsonPath("$.secondary[0].id").value(news.get(3).toString()))
			.andExpect(jsonPath("$.secondary[*].id", not(hasItem(automatic.toString()))));

		setOrder(list(news.get(2), news.get(3)));
		mvc.perform(get("/api/v1/public/news/featured"))
			.andExpect(jsonPath("$.mainAutomatic").value(false))
			.andExpect(jsonPath("$.main.id").value(news.get(2).toString()));
	}

	// ------------------------------------------------------------------ História 3

	@Test
	void unpublishingOrTrashingLeavesTheTopAndTheRestMovesUp() throws Exception {
		setOrder(list(news.get(0), news.get(1), news.get(2), news.get(3)));

		mvc.perform(post("/api/v1/admin/news/" + news.get(0) + "/unpublish").header("Authorization", admin))
			.andExpect(status().isOk());
		assertThat(order()).containsExactly(news.get(1), news.get(2), news.get(3));
		assertThat(jdbc.sql("""
				SELECT details->>'removedFromFeatured' FROM audit_logs WHERE action = 'UNPUBLISH'
				AND entity_id = :id""").param("id", news.get(0).toString()).query(String.class).single()).isEqualTo("1");

		mvc.perform(delete("/api/v1/admin/news/" + news.get(2)).header("Authorization", admin))
			.andExpect(status().isOk());
		assertThat(order()).containsExactly(news.get(1), news.get(3));

		mvc.perform(post("/api/v1/admin/news/" + news.get(0) + "/publish").header("Authorization", admin))
			.andExpect(status().isOk());
		assertThat(order()).as("publicar de novo não devolve ao destaque").doesNotContain(news.get(0));
	}

	@Test
	void sponsoredNeverMovesUpToTheHeadline() throws Exception {
		setOrder(list(news.get(0), sponsored, news.get(1)));

		mvc.perform(post("/api/v1/admin/news/" + news.get(0) + "/unpublish").header("Authorization", admin))
			.andExpect(status().isOk());

		assertThat(order()).containsExactly(null, sponsored, news.get(1));
	}

	// ------------------------------------------------------------------ História 2

	@Test
	void shortcutsShiftTheOthersAndCutAtTen() throws Exception {
		setOrder(list(news.get(0), news.get(1)));

		feature(admin, news.get(2), "MAIN").andExpect(status().isOk());
		assertThat(order()).containsExactly(news.get(2), news.get(0), news.get(1));

		feature(admin, news.get(3), "HIGHLIGHT").andExpect(status().isOk());
		assertThat(order()).containsExactly(news.get(2), news.get(3), news.get(0), news.get(1));

		feature(admin, news.get(0), "NONE").andExpect(status().isOk());
		assertThat(order()).containsExactly(news.get(2), news.get(3), news.get(1));

		// Já no destaque: MAIN leva para o topo sem duplicar.
		feature(admin, news.get(1), "MAIN").andExpect(status().isOk());
		assertThat(order()).containsExactly(news.get(1), news.get(2), news.get(3));

		setOrder(new ArrayList<>(news.subList(0, 10)));
		feature(admin, news.get(12), "MAIN").andExpect(status().isOk());
		List<UUID> expected = new ArrayList<>(news.subList(0, 9));
		expected.addFirst(news.get(12));
		assertThat(order()).as("a 10ª sai").containsExactlyElementsOf(expected);
		assertThat(count("SELECT count(*) FROM audit_logs WHERE action = 'HOME_FEATURE' AND details->>'shortcut' = 'MAIN'"))
			.isEqualTo(3);
	}

	@Test
	void highlightKeepsAnAutomaticHeadlineAndSponsoredRules() throws Exception {
		setOrder(list(null, news.get(0)));

		feature(admin, news.get(1), "HIGHLIGHT").andExpect(status().isOk());
		assertThat(order()).containsExactly(null, news.get(1), news.get(0));

		feature(admin, sponsored, "MAIN").andExpect(status().isUnprocessableContent());
		feature(admin, sponsored, "HIGHLIGHT").andExpect(status().isOk());

		UUID draft = news.get(6);
		jdbc.sql("UPDATE news SET status = 'DRAFT' WHERE id = :id").param("id", draft).update();
		feature(admin, draft, "MAIN").andExpect(status().isUnprocessableContent());
		feature(admin, UUID.randomUUID(), "MAIN").andExpect(status().isNotFound());
	}

}
