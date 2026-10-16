package br.com.zonasulurgente.api.media;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;

/**
 * Fotos enviadas pelo painel (BE-012). {@code storage}: "s3" (Cloudflare R2, produção) ou "local"
 * (pasta servida pela própria API em /media/**, só para desenvolvimento). {@code publicBaseUrl}:
 * de onde o leitor baixa as fotos (produção: https://media.&lt;dominio&gt;).
 */
@ConfigurationProperties("zsu.media")
public record MediaProperties(
		@DefaultValue("local") String storage,
		@DefaultValue("http://localhost:8080") String publicBaseUrl,
		@DefaultValue("media-local") String localDir,
		@DefaultValue("10MB") DataSize maxSize,
		@DefaultValue("100000000") long maxPixels,
		@DefaultValue("2") int maxConcurrent,
		@DefaultValue S3 s3) {

	/** Bucket S3 compatível (R2: endpoint https://&lt;conta&gt;.r2.cloudflarestorage.com, região "auto"). */
	public record S3(
			@DefaultValue("") String endpoint,
			@DefaultValue("") String bucket,
			@DefaultValue("auto") String region,
			@DefaultValue("") String accessKey,
			@DefaultValue("") String secretKey,
			@DefaultValue("false") boolean pathStyle) {
	}

	/** Endereço público de um arquivo guardado com esta chave. */
	public String urlOf(String key) {
		return publicBaseUrl.replaceAll("/+$", "") + "/" + key;
	}

	/** O endereço é de uma foto enviada pelo painel (e não um link externo)? */
	public boolean isOwnUrl(String url) {
		return url != null && url.startsWith(publicBaseUrl.replaceAll("/+$", "") + "/media/");
	}

}
