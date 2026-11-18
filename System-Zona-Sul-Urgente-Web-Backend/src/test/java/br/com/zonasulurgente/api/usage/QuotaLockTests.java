package br.com.zonasulurgente.api.usage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.TestSessions;
import br.com.zonasulurgente.api.TestcontainersConfiguration;

/**
 * Spec 004, História 3 (fotos): com o espaço ou as gravações no limite de trava, o envio é recusado com 507 e nada é
 * gravado; abaixo da trava, aceita e conta o tamanho real; a conta do sistema trava mesmo com a nuvem atrasada
 * (FR-010); leituras e disco nunca travam (FR-011).
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class QuotaLockTests {

	static final String REPORTER = "ana.ribeiro@zonasulurgente.com.br";
	static final long LIMIT = 100_000_000L;
	static final Path DIR;

	static {
		try {
			DIR = Files.createTempDirectory("zsu-quota-test");
		}
		catch (IOException e) {
			throw new IllegalStateException(e);
		}
	}

	@DynamicPropertySource
	static void config(DynamicPropertyRegistry registry) {
		registry.add("zsu.media.local-dir", DIR::toString);
		registry.add("zsu.usage.resources[fotos.espaco].limit", () -> String.valueOf(LIMIT));
		registry.add("zsu.usage.resources[fotos.gravacoes].limit", () -> "1000");
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	@Autowired
	QuotaGuard quota;

	@BeforeEach
	void reset() {
		jdbc.sql("DELETE FROM usage_counters").update();
		jdbc.sql("DELETE FROM usage_state").update();
	}

	static byte[] jpeg() throws IOException {
		BufferedImage image = new BufferedImage(1200, 800, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(new Color(2, 75, 170));
		g.fillRect(0, 0, 1200, 800);
		g.dispose();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", out);
		return out.toByteArray();
	}

	private long files() throws IOException {
		try (Stream<Path> all = Files.walk(DIR)) {
			return all.filter(Files::isRegularFile).count();
		}
	}

	private long assets() {
		return jdbc.sql("SELECT count(*) FROM media_assets").query(Long.class).single();
	}

	@Test
	void uploadBelowTheLockIsAcceptedAndCountsTheRealSize() throws Exception {
		mvc.perform(multipart("/api/v1/admin/media").file(new MockMultipartFile("file", "a.jpg", "image/jpeg", jpeg()))
			.header("Authorization", TestSessions.bearer(jdbc, REPORTER)))
			.andExpect(status().isOk());

		var row = jdbc.sql("SELECT stored_bytes, stored_objects FROM media_assets ORDER BY created_at DESC LIMIT 1")
			.query().singleRow();
		long stored = ((Number) row.get("stored_bytes")).longValue();
		assertThat(stored).isPositive();
		assertThat(((Number) row.get("stored_objects")).intValue()).isBetween(5, 9);
		assertThat(jdbc.sql("SELECT count FROM usage_counters WHERE resource = 'fotos.espaco'").query(Long.class)
			.single()).as("conta o tamanho real de todas as versões").isEqualTo(stored);
	}

	@Test
	void uploadAboveTheSpaceLockIsRefusedAndNothingIsStored() throws Exception {
		quota.record("fotos.espaco", LIMIT * 95 / 100);
		long filesBefore = files();
		long assetsBefore = assets();

		mvc.perform(multipart("/api/v1/admin/media").file(new MockMultipartFile("file", "a.jpg", "image/jpeg", jpeg()))
			.header("Authorization", TestSessions.bearer(jdbc, REPORTER)))
			.andExpect(status().isInsufficientStorage())
			.andExpect(jsonPath("$.title").value("Espaço de fotos esgotado"))
			.andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("sem a foto")));

		assertThat(files()).isEqualTo(filesBefore);
		assertThat(assets()).isEqualTo(assetsBefore);
	}

	@Test
	void writesOfTheMonthAlsoLock() throws Exception {
		quota.record("fotos.gravacoes", 950);

		mvc.perform(multipart("/api/v1/admin/media").file(new MockMultipartFile("file", "a.jpg", "image/jpeg", jpeg()))
			.header("Authorization", TestSessions.bearer(jdbc, REPORTER)))
			.andExpect(status().isInsufficientStorage())
			.andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("gravações")));
	}

	@Test
	void systemCountLocksEvenWhenTheCloudIsBehind() {
		// A nuvem ainda diz que há espaço (leitura atrasada), mas o sistema já gravou perto do limite: trava (FR-010).
		jdbc.sql("""
				INSERT INTO usage_state (resource, cloud_value, cloud_read_at) VALUES ('fotos.espaco', 1000, now())""")
			.update();
		quota.record("fotos.espaco", LIMIT * 96 / 100);

		assertThatThrownBy(() -> quota.check("fotos.espaco", 1)).isInstanceOf(QuotaBlockedException.class);
	}

	@Test
	void readsAndDiskNeverLock() {
		quota.record("fotos.leituras", 999_999_999L);
		assertThatCode(() -> quota.check("fotos.leituras", 1_000_000)).doesNotThrowAnyException();
		assertThatCode(() -> quota.check("disco", Long.MAX_VALUE / 2)).doesNotThrowAnyException();
		assertThatCode(() -> quota.check("nao.configurado", 1)).doesNotThrowAnyException();
	}

}
