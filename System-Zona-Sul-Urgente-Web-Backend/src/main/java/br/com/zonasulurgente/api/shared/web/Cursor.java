package br.com.zonasulurgente.api.shared.web;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Cursores opacos de paginação (BE-004). Listas por data usam keyset (data + id da última
 * notícia: estável mesmo com notícias novas chegando); a busca, ordenada por relevância, usa
 * deslocamento. O conteúdo é interno: cliente só devolve o que recebeu.
 */
public final class Cursor {

	private static final Pattern KEYSET = Pattern.compile("k:(-?\\d+):([0-9a-f-]{36})");
	private static final Pattern OFFSET = Pattern.compile("o:(\\d{1,6})");

	public record Keyset(OffsetDateTime publishedAt, UUID id) {
	}

	private Cursor() {
	}

	public static String keyset(OffsetDateTime publishedAt, UUID id) {
		long micros = publishedAt.toInstant().getEpochSecond() * 1_000_000
				+ publishedAt.toInstant().getNano() / 1_000;
		return encode("k:" + micros + ":" + id);
	}

	public static Keyset parseKeyset(String cursor) {
		Matcher m = KEYSET.matcher(decode(cursor));
		if (!m.matches()) {
			throw invalid();
		}
		long micros = Long.parseLong(m.group(1));
		Instant at = Instant.ofEpochSecond(Math.floorDiv(micros, 1_000_000),
				Math.floorMod(micros, 1_000_000) * 1_000L);
		return new Keyset(OffsetDateTime.ofInstant(at, ZoneOffset.UTC), UUID.fromString(m.group(2)));
	}

	public static String offset(int offset) {
		return encode("o:" + offset);
	}

	public static int parseOffset(String cursor) {
		Matcher m = OFFSET.matcher(decode(cursor));
		if (!m.matches()) {
			throw invalid();
		}
		return Integer.parseInt(m.group(1));
	}

	private static String encode(String raw) {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
	}

	private static String decode(String cursor) {
		try {
			return new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
		}
		catch (IllegalArgumentException ex) {
			throw invalid();
		}
	}

	private static BadRequestException invalid() {
		return new BadRequestException("Cursor de paginação inválido.");
	}

}
