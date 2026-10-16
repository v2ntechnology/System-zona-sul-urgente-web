package br.com.zonasulurgente.api.auth.application;

import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * TOTP (RFC 6238): HMAC-SHA1, passo de 30 s, 6 dígitos — o padrão dos apps autenticadores
 * (Google Authenticator, Authy, 1Password). Aceita o passo anterior e o seguinte (relógio
 * do celular adiantado/atrasado) e nunca o mesmo passo duas vezes (anti-reuso).
 */
public final class Totp {

	private static final int STEP_SECONDS = 30;
	private static final int DIGITS = 6;
	private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	private static final SecureRandom RANDOM = new SecureRandom();

	private Totp() {
	}

	/** Segredo novo de 160 bits, em base32 (o formato que os apps leem). */
	public static String newSecret() {
		byte[] bytes = new byte[20];
		RANDOM.nextBytes(bytes);
		return base32(bytes);
	}

	public static long step(Instant now) {
		return now.getEpochSecond() / STEP_SECONDS;
	}

	public static String code(String secret, long step) {
		try {
			Mac mac = Mac.getInstance("HmacSHA1");
			mac.init(new SecretKeySpec(unbase32(secret), "HmacSHA1"));
			byte[] h = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
			int offset = h[h.length - 1] & 0x0f;
			int binary = ((h[offset] & 0x7f) << 24) | ((h[offset + 1] & 0xff) << 16)
					| ((h[offset + 2] & 0xff) << 8) | (h[offset + 3] & 0xff);
			return String.format("%06d", binary % 1_000_000);
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException(ex);
		}
	}

	/**
	 * Confere o código e devolve o passo usado, ou -1 se inválido. Passos já usados
	 * ({@code <= lastStep}) são recusados.
	 */
	public static long verify(String secret, String code, Instant now, long lastStep) {
		if (code == null || !code.matches("\\d{" + DIGITS + "}")) {
			return -1;
		}
		long current = step(now);
		for (long candidate = current - 1; candidate <= current + 1; candidate++) {
			if (candidate > lastStep && MessageDigest.isEqual(
					code(secret, candidate).getBytes(StandardCharsets.US_ASCII),
					code.getBytes(StandardCharsets.US_ASCII))) {
				return candidate;
			}
		}
		return -1;
	}

	/** URI do QR code (otpauth://totp/...). */
	public static String otpauthUri(String issuer, String account, String secret) {
		String label = enc(issuer) + ":" + enc(account);
		return "otpauth://totp/" + label + "?secret=" + secret + "&issuer=" + enc(issuer)
				+ "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
	}

	private static String enc(String value) {
		return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
	}

	static String base32(byte[] data) {
		var out = new StringBuilder();
		int buffer = 0;
		int bits = 0;
		for (byte b : data) {
			buffer = (buffer << 8) | (b & 0xff);
			bits += 8;
			while (bits >= 5) {
				out.append(BASE32.charAt((buffer >> (bits - 5)) & 31));
				bits -= 5;
			}
		}
		if (bits > 0) {
			out.append(BASE32.charAt((buffer << (5 - bits)) & 31));
		}
		return out.toString();
	}

	static byte[] unbase32(String text) {
		String clean = text.replace("=", "").replace(" ", "").toUpperCase();
		var out = new java.io.ByteArrayOutputStream();
		int buffer = 0;
		int bits = 0;
		for (char c : clean.toCharArray()) {
			int value = BASE32.indexOf(c);
			if (value < 0) {
				throw new IllegalArgumentException("Segredo TOTP inválido.");
			}
			buffer = (buffer << 5) | value;
			bits += 5;
			if (bits >= 8) {
				out.write((buffer >> (bits - 8)) & 0xff);
				bits -= 8;
			}
		}
		return out.toByteArray();
	}

}
