package br.com.zonasulurgente.api.team;

import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.auth.application.Tokens;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.InvalidFieldsException;

/**
 * Aceite do convite: a pessoa abre o link, vê o próprio nome/e-mail e cria a senha. Depois
 * entra pelo login normal (Admin, Editor e Comercial cadastram o 2FA no primeiro acesso).
 */
@Service
public class InvitationService {

	static final int PASSWORD_MIN = 10;
	static final int PASSWORD_MAX = 128;

	public record Invitation(String name, String email) {
	}

	private record Pending(UUID id, UUID userId, String name, String email) {
	}

	private final JdbcClient jdbc;
	private final PasswordEncoder passwords;

	InvitationService(JdbcClient jdbc, PasswordEncoder passwords) {
		this.jdbc = jdbc;
		this.passwords = passwords;
	}

	@Transactional(readOnly = true)
	public Invitation check(String token) {
		Pending p = pending(token, false);
		return new Invitation(p.name(), p.email());
	}

	@Transactional
	public Invitation accept(String token, String password) {
		Pending p = pending(token, true);
		String pw = password == null ? "" : password;
		if (pw.length() < PASSWORD_MIN) {
			throw new InvalidFieldsException(Map.of("password", "Use pelo menos " + PASSWORD_MIN + " caracteres."));
		}
		if (pw.length() > PASSWORD_MAX) {
			throw new InvalidFieldsException(Map.of("password", "No máximo " + PASSWORD_MAX + " caracteres."));
		}
		if (pw.strip().equalsIgnoreCase(p.email()) || pw.strip().equalsIgnoreCase(p.email().split("@")[0])) {
			throw new InvalidFieldsException(Map.of("password", "A senha não pode ser o seu e-mail."));
		}
		jdbc.sql("""
				UPDATE users SET password_hash = :hash, password_changed_at = now(), status = 'ACTIVE', updated_at = now()
				WHERE id = :id""")
			.param("hash", passwords.encode(pw))
			.param("id", p.userId())
			.update();
		jdbc.sql("UPDATE user_invitations SET used_at = now() WHERE id = :id").param("id", p.id()).update();
		return new Invitation(p.name(), p.email());
	}

	private Pending pending(String token, boolean lock) {
		if (token == null || token.isBlank()) {
			throw invalid();
		}
		return jdbc.sql("""
				SELECT i.id, u.id AS user_id, u.name, u.email FROM user_invitations i JOIN users u ON u.id = i.user_id
				WHERE i.token_hash = :hash AND i.used_at IS NULL AND i.expires_at > now() AND u.status = 'INVITED'"""
				+ (lock ? " FOR UPDATE OF i" : ""))
			.param("hash", Tokens.hash(token))
			.query((rs, i) -> new Pending(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
					rs.getString("name"), rs.getString("email")))
			.optional()
			.orElseThrow(InvitationService::invalid);
	}

	private static ApiException invalid() {
		return new ApiException(HttpStatus.NOT_FOUND, "Convite inválido",
				"Este link de convite não vale mais (já foi usado ou venceu). Peça um novo ao administrador.");
	}

}
