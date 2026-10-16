package br.com.zonasulurgente.api.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Stream;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

import br.com.zonasulurgente.api.TestcontainersConfiguration;
import br.com.zonasulurgente.api.auth.application.Tokens;

/** BE-012: envio de foto com libvips de verdade e armazenamento local (pasta temporária). */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class MediaUploadTests {

	static final Path DIR;

	static {
		try {
			DIR = Files.createTempDirectory("zsu-media-test");
		}
		catch (IOException e) {
			throw new IllegalStateException(e);
		}
	}

	@DynamicPropertySource
	static void media(DynamicPropertyRegistry registry) {
		registry.add("zsu.media.local-dir", DIR::toString);
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcClient jdbc;

	private String token(String email) {
		String token = Tokens.newToken();
		jdbc.sql("""
				INSERT INTO sessions (token_hash, user_id, expires_at)
				SELECT :hash, id, :expires FROM users WHERE email = :email""")
			.param("hash", Tokens.hash(token))
			.param("expires", OffsetDateTime.now().plusDays(1))
			.param("email", email)
			.update();
		return "Bearer " + token;
	}

	/** JPEG 1600×900 "deitado" com EXIF Orientation=6 (câmera girada: a foto real é 900×1600). */
	static byte[] rotatedJpegWithExif() throws IOException {
		BufferedImage image = new BufferedImage(1600, 900, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(new Color(2, 75, 170));
		g.fillRect(0, 0, 1600, 900);
		g.setColor(Color.WHITE);
		g.fillOval(600, 250, 400, 400);
		g.dispose();
		ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", jpeg);
		byte[] plain = jpeg.toByteArray();

		byte[] tiff = { 'M', 'M', 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0 };
		byte[] exifHeader = "Exif\0\0".getBytes(StandardCharsets.US_ASCII);
		int length = 2 + exifHeader.length + tiff.length;
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		out.write(plain, 0, 2); // SOI
		out.write(new byte[] { (byte) 0xFF, (byte) 0xE1, (byte) (length >> 8), (byte) length });
		out.write(exifHeader);
		out.write(tiff);
		out.write(plain, 2, plain.length - 2);
		return out.toByteArray();
	}

	@Test
	void uploadGeneratesUprightVariantsWithoutMetadata() throws Exception {
		String json = mvc.perform(multipart("/api/v1/admin/media")
				.file(new MockMultipartFile("file", "IMG_0001.jpg", "image/jpeg", rotatedJpegWithExif()))
				.header("Authorization", token("ana.ribeiro@zonasulurgente.com.br")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.width").value(900))
			.andExpect(jsonPath("$.height").value(1600))
			.andReturn().getResponse().getContentAsString();
		String url = JsonPath.read(json, "$.url");
		assertThat(url).matches("http://localhost:8080/media/\\d{4}/\\d{2}/[0-9a-f-]{36}/900\\.webp");

		String key = url.substring("http://localhost:8080/".length(), url.lastIndexOf('/'));
		Path folder = DIR.resolve(key);
		List<String> names;
		try (Stream<Path> files = Files.list(folder)) {
			names = files.map(p -> p.getFileName().toString()).sorted().toList();
		}
		assertThat(names).containsExactly("400.avif", "400.webp", "800.avif", "800.webp", "900.avif", "900.webp",
				"og.jpg", "original.jpg");

		for (String name : names) {
			byte[] content = Files.readAllBytes(folder.resolve(name));
			assertThat(new String(content, StandardCharsets.ISO_8859_1)).as("sem EXIF em " + name).doesNotContain("Exif");
		}
		BufferedImage og = ImageIO.read(new ByteArrayInputStream(Files.readAllBytes(folder.resolve("og.jpg"))));
		assertThat(og.getWidth()).isEqualTo(1200);
		assertThat(og.getHeight()).isEqualTo(630);
		BufferedImage original = ImageIO.read(folder.resolve("original.jpg").toFile());
		assertThat(original.getWidth()).as("original já em pé").isEqualTo(900);

		// A API serve a pasta local com cache longo.
		mvc.perform(get("/" + key + "/800.webp"))
			.andExpect(status().isOk())
			.andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("immutable")));

		var row = jdbc.sql("SELECT width, height, mime_type, variants::text FROM media_assets WHERE url = :url")
			.param("url", url)
			.query((rs, i) -> List.of(rs.getInt(1), rs.getInt(2), rs.getString(3), rs.getString(4)))
			.single();
		assertThat(row.get(0)).isEqualTo(900);
		assertThat(row.get(1)).isEqualTo(1600);
		assertThat(row.get(2)).isEqualTo("image/jpeg");
		assertThat((String) row.get(3)).contains("[400, 800, 900]");
	}

	/**
	 * Regressão: foto grande sem giro reduz lendo o JPEG em sequência; gravar AVIF e WebP da
	 * mesma redução falhava com "out of order read".
	 */
	@Test
	void largeLandscapePhotoGetsEveryWidth() throws Exception {
		BufferedImage image = new BufferedImage(2400, 1600, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setPaint(new java.awt.GradientPaint(0, 0, new Color(253, 49, 50), 2400, 1600, new Color(2, 75, 170)));
		g.fillRect(0, 0, 2400, 1600);
		g.dispose();
		ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
		ImageIO.write(image, "jpg", jpeg);
		String json = mvc.perform(multipart("/api/v1/admin/media")
				.file(new MockMultipartFile("file", "paisagem.jpg", "image/jpeg", jpeg.toByteArray()))
				.header("Authorization", token("ana.ribeiro@zonasulurgente.com.br")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.width").value(1200))
			.andExpect(jsonPath("$.height").value(800))
			.andReturn().getResponse().getContentAsString();
		String url = JsonPath.read(json, "$.url");
		Path folder = DIR.resolve(url.substring("http://localhost:8080/".length(), url.lastIndexOf('/')));
		for (String name : List.of("400.avif", "400.webp", "800.avif", "800.webp", "1200.avif", "1200.webp")) {
			assertThat(folder.resolve(name)).exists();
		}
	}

	@Test
	void fakeImageIsRejectedByItsRealContent() throws Exception {
		mvc.perform(multipart("/api/v1/admin/media")
				.file(new MockMultipartFile("file", "foto.jpg", "image/jpeg", "<script>alert(1)</script>".getBytes()))
				.header("Authorization", token("ana.ribeiro@zonasulurgente.com.br")))
			.andExpect(status().isUnsupportedMediaType())
			.andExpect(jsonPath("$.detail").value("Envie uma foto em JPEG, PNG, WebP ou HEIC."));
	}

	@Test
	void uploadRequiresLogin() throws Exception {
		mvc.perform(multipart("/api/v1/admin/media")
				.file(new MockMultipartFile("file", "foto.jpg", "image/jpeg", rotatedJpegWithExif())))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void savingTheNewsReusesTheUploadedPhotoWithItsRealSize() throws Exception {
		String auth = token("juliana.prado@zonasulurgente.com.br");
		String url = JsonPath.read(mvc.perform(multipart("/api/v1/admin/media")
				.file(new MockMultipartFile("file", "foto.jpg", "image/jpeg", rotatedJpegWithExif()))
				.header("Authorization", auth))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString(), "$.url");
		long before = jdbc.sql("SELECT count(*) FROM media_assets").query(Long.class).single();

		String draft = """
				{"title":"Foto enviada pelo painel na matéria","subtitle":"","summary":"Resumo com mais de trinta caracteres para o Google.",
				 "body":[{"type":"paragraph","html":"Texto."}],"categorySlug":"cidade","authorSlugs":["juliana-prado"],
				 "neighborhoodSlug":"copacabana","tagSlugs":[],"newTags":[],
				 "image":{"url":"%s","alt":"Círculo branco em fundo azul","caption":"Legenda","credit":"Foto: Redação"},
				 "isUrgent":false,"isSponsored":false,"sponsorName":"","seo":{"title":"","description":""},
				 "status":"DRAFT","scheduledFor":"","origin":"MANUAL"}""".formatted(url);
		String slug = JsonPath.read(mvc.perform(post("/api/v1/admin/news").header("Authorization", auth)
				.contentType(MediaType.APPLICATION_JSON).content("{\"intent\":\"publish\",\"draft\":" + draft + "}"))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString(), "$.slug");

		assertThat(jdbc.sql("SELECT count(*) FROM media_assets").query(Long.class).single())
			.as("reaproveita o registro do envio").isEqualTo(before);
		mvc.perform(get("/api/v1/public/news/{slug}", slug))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.image.url").value(url))
			.andExpect(jsonPath("$.image.width").value(900))
			.andExpect(jsonPath("$.image.height").value(1600))
			.andExpect(jsonPath("$.image.alt").value("Círculo branco em fundo azul"))
			.andExpect(jsonPath("$.image.credit").value("Foto: Redação"));
	}

	@Test
	void targetWidthsNeverUpscale() {
		assertThat(ImageProcessor.targetWidths(2400)).containsExactly(400, 800, 1200);
		assertThat(ImageProcessor.targetWidths(900)).containsExactly(400, 800, 900);
		assertThat(ImageProcessor.targetWidths(800)).containsExactly(400, 800);
		assertThat(ImageProcessor.targetWidths(300)).containsExactly(300);
	}

	@Test
	void sniffsRealTypes() {
		assertThat(ImageType.sniff(new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0 })).contains(ImageType.JPEG);
		byte[] heic = { 0, 0, 0, 24, 'f', 't', 'y', 'p', 'h', 'e', 'i', 'c', 0, 0 };
		assertThat(ImageType.sniff(heic)).contains(ImageType.HEIC);
		byte[] avif = { 0, 0, 0, 24, 'f', 't', 'y', 'p', 'a', 'v', 'i', 'f', 0, 0 };
		assertThat(ImageType.sniff(avif)).contains(ImageType.AVIF);
		assertThat(ImageType.sniff("GIF89a".getBytes())).isEmpty();
	}

}
