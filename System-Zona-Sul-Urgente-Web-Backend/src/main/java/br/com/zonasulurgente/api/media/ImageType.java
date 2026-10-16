package br.com.zonasulurgente.api.media;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;

/**
 * Tipo real da foto pelos primeiros bytes (não confia na extensão nem no Content-Type enviados).
 * HEIC é o padrão das câmeras do iPhone.
 */
enum ImageType {

	JPEG("image/jpeg", "jpg"), PNG("image/png", "png"), WEBP("image/webp", "webp"), HEIC("image/heic", "jpg"),
	AVIF("image/avif", "jpg");

	private static final Set<String> HEIF_BRANDS = Set.of("heic", "heix", "hevc", "hevx", "heim", "heis", "mif1",
			"msf1");

	final String mime;

	/** Formato em que o original (sem metadados) é guardado. */
	final String originalExtension;

	ImageType(String mime, String originalExtension) {
		this.mime = mime;
		this.originalExtension = originalExtension;
	}

	static Optional<ImageType> sniff(byte[] b) {
		if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
			return Optional.of(JPEG);
		}
		if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
			return Optional.of(PNG);
		}
		if (b.length >= 12 && ascii(b, 0, 4).equals("RIFF") && ascii(b, 8, 4).equals("WEBP")) {
			return Optional.of(WEBP);
		}
		if (b.length >= 12 && ascii(b, 4, 4).equals("ftyp")) {
			String brand = ascii(b, 8, 4);
			if (brand.equals("avif") || brand.equals("avis")) {
				return Optional.of(AVIF);
			}
			if (HEIF_BRANDS.contains(brand)) {
				return Optional.of(HEIC);
			}
		}
		return Optional.empty();
	}

	private static String ascii(byte[] b, int from, int length) {
		return new String(b, from, length, StandardCharsets.US_ASCII);
	}

}
