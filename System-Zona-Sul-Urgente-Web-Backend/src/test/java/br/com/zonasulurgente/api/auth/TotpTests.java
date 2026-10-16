package br.com.zonasulurgente.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.junit.jupiter.api.Test;

import br.com.zonasulurgente.api.auth.application.Totp;

/** RFC 6238, apêndice B (SHA-1), truncado para 6 dígitos. */
class TotpTests {

	// "12345678901234567890" em base32.
	private static final String RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

	@Test
	void matchesRfcTestVectors() {
		assertThat(Totp.code(RFC_SECRET, Totp.step(Instant.ofEpochSecond(59)))).isEqualTo("287082");
		assertThat(Totp.code(RFC_SECRET, Totp.step(Instant.ofEpochSecond(1111111109)))).isEqualTo("081804");
		assertThat(Totp.code(RFC_SECRET, Totp.step(Instant.ofEpochSecond(2000000000)))).isEqualTo("279037");
	}

	@Test
	void acceptsNeighbourStepsButNeverTheSameStepTwice() {
		Instant now = Instant.ofEpochSecond(1_800_000_000);
		long step = Totp.step(now);
		String code = Totp.code(RFC_SECRET, step);
		assertThat(Totp.verify(RFC_SECRET, code, now, 0)).isEqualTo(step);
		assertThat(Totp.verify(RFC_SECRET, code, now, step)).isEqualTo(-1);
		assertThat(Totp.verify(RFC_SECRET, Totp.code(RFC_SECRET, step - 1), now, 0)).isEqualTo(step - 1);
		assertThat(Totp.verify(RFC_SECRET, Totp.code(RFC_SECRET, step - 2), now, 0)).isEqualTo(-1);
		assertThat(Totp.verify(RFC_SECRET, "12345", now, 0)).isEqualTo(-1);
	}

	@Test
	void newSecretsAreBase32AndOtpauthUriIsEscaped() {
		String secret = Totp.newSecret();
		assertThat(secret).matches("[A-Z2-7]{32}");
		assertThat(Totp.otpauthUri("Zona Sul Urgente", "ana@x.com", secret))
			.startsWith("otpauth://totp/Zona%20Sul%20Urgente:ana%40x.com?secret=" + secret);
		assertThat("12345678901234567890".getBytes(StandardCharsets.US_ASCII)).hasSize(20);
	}

}
