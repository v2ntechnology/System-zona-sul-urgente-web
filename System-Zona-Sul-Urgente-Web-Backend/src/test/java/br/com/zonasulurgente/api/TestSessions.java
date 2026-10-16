package br.com.zonasulurgente.api;

import java.time.OffsetDateTime;

import org.springframework.jdbc.core.simple.JdbcClient;

import br.com.zonasulurgente.api.auth.application.Tokens;

/** Sessão pronta para uma conta (sem passar pelo login/2FA, que têm testes próprios). */
public final class TestSessions {

	private TestSessions() {
	}

	public static String bearer(JdbcClient jdbc, String email) {
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

}
