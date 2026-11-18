package br.com.zonasulurgente.api.media;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import br.com.zonasulurgente.api.audit.AuditAction;
import br.com.zonasulurgente.api.audit.AuditEvent;
import br.com.zonasulurgente.api.audit.AuditLog;
import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.usage.QuotaGuard;
import tools.jackson.databind.json.JsonMapper;

/**
 * Envio de foto pelo painel (BE-012): valida o tipo real e o tamanho, gera os derivados, grava
 * em media/{aaaa}/{mm}/{uuid}/ e registra em media_assets. O editor recebe o endereço da maior
 * versão WebP; o site monta as demais larguras a partir dele. O registro e a auditoria (BE-008) saem
 * juntos numa transação curta, depois do processamento (que não segura conexão do banco).
 */
@Service
public class MediaService {

	private static final ZoneId BRASILIA = ZoneId.of("America/Sao_Paulo");

	public record Uploaded(UUID id, String url, int width, int height) {
	}

	/** Recursos do monitor de uso (spec 004, zsu.usage.resources). */
	static final String SPACE = "fotos.espaco";
	static final String WRITES = "fotos.gravacoes";
	/** Original + 3 larguras × 2 formatos + og = até 8; arredondado para cima. */
	static final int EXPECTED_FILES = 9;

	private final MediaProperties props;
	private final ImageProcessor processor;
	private final MediaStorage storage;
	private final JdbcClient jdbc;
	private final JsonMapper json;
	private final TransactionTemplate tx;
	private final AuditLog audit;
	private final QuotaGuard quota;

	MediaService(MediaProperties props, ImageProcessor processor, MediaStorage storage, JdbcClient jdbc,
			JsonMapper json, TransactionTemplate tx, AuditLog audit, QuotaGuard quota) {
		this.tx = tx;
		this.audit = audit;
		this.quota = quota;
		this.props = props;
		this.processor = processor;
		this.storage = storage;
		this.jdbc = jdbc;
		this.json = json;
	}

	public Uploaded upload(byte[] bytes, AuthenticatedUser user) {
		if (bytes.length == 0) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "Arquivo vazio", "Escolha uma foto para enviar.");
		}
		if (bytes.length > props.maxSize().toBytes()) {
			throw tooLarge(props);
		}
		ImageType type = ImageType.sniff(bytes)
			.orElseThrow(() -> new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Formato não aceito",
					"Envie uma foto em JPEG, PNG, WebP ou HEIC."));

		// Antes de gastar a cota grátis (spec 004): ~3 × o original com as versões, ~9 arquivos por foto.
		quota.check(SPACE, 3L * bytes.length);
		quota.check(WRITES, EXPECTED_FILES);

		ImageProcessor.Result result = processor.process(bytes, type);
		UUID id = UUID.randomUUID();
		LocalDate today = LocalDate.now(BRASILIA);
		String key = "media/%d/%02d/%s".formatted(today.getYear(), today.getMonthValue(), id);
		String original = null;
		long storedBytes = 0;
		for (ImageProcessor.File file : result.files()) {
			storage.put(key + "/" + file.name(), file.content(), file.contentType());
			storedBytes += file.content().length;
			if (file.name().startsWith("original.")) {
				original = file.name();
			}
		}

		long storedTotal = storedBytes;
		int largest = result.widths().getLast();
		String url = props.urlOf(key + "/" + largest + ".webp");
		Map<String, Object> variants = new LinkedHashMap<>();
		variants.put("widths", result.widths());
		variants.put("formats", List.of("avif", "webp"));
		variants.put("og", "og.jpg");
		variants.put("original", original);
		tx.executeWithoutResult(status -> {
			jdbc.sql("""
					INSERT INTO media_assets (id, url, width, height, alt, storage_key, mime_type, bytes, variants, created_by,
					  stored_bytes, stored_objects)
					VALUES (:id, :url, :width, :height, '', :key, :mime, :bytes, :variants::jsonb, :user, :stored, :objects)""")
				.param("id", id)
				.param("url", url)
				.param("width", result.width())
				.param("height", result.height())
				.param("key", key)
				.param("mime", type.mime)
				.param("bytes", (long) bytes.length)
				.param("variants", json.writeValueAsString(variants))
				.param("user", user.id())
				.param("stored", storedTotal)
				.param("objects", result.files().size())
				.update();
			audit.record(AuditEvent.of(AuditAction.CREATE, "media", id, url)
				.detail("mime", type.mime)
				.detail("bytes", (long) bytes.length)
				.detail("width", result.width())
				.detail("height", result.height()), AuditLog.Actor.of(user));
		});
		quota.record(SPACE, storedBytes);
		quota.record(WRITES, result.files().size());
		return new Uploaded(id, url, result.width(), result.height());
	}

	static ApiException tooLarge(MediaProperties props) {
		return new ApiException(HttpStatus.CONTENT_TOO_LARGE, "Foto grande demais",
				"A foto pode ter no máximo %d MB.".formatted(props.maxSize().toMegabytes()));
	}

}
