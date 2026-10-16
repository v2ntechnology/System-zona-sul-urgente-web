package br.com.zonasulurgente.api.auth.infrastructure;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Persistência da autenticação (BE-006): usuários, sessões, desafios, tentativas e TOTP. */
@Repository
public class AuthRepository {

	public record UserRow(UUID id, String name, String email, String passwordHash, String role,
			String status, boolean requiresTotp, String authorSlug) {
	}

	public record TotpRow(String secretEncrypted, boolean confirmed, long lastStep) {
	}

	public record ChallengeRow(UUID id, UUID userId, boolean setup, int attempts,
			OffsetDateTime expiresAt, OffsetDateTime usedAt) {
	}

	public record SessionRow(UUID id, UUID userId, OffsetDateTime lastSeenAt, OffsetDateTime expiresAt,
			OffsetDateTime revokedAt) {
	}

	private static final String USER_SELECT = """
			SELECT u.id, u.name, u.email, u.password_hash, u.role_code, u.status, r.requires_totp,
			       a.slug AS author_slug
			FROM users u
			JOIN roles r ON r.code = u.role_code
			LEFT JOIN authors a ON a.id = u.author_id""";

	private final JdbcClient jdbc;

	public AuthRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	public Optional<UserRow> userByEmail(String email) {
		return jdbc.sql(USER_SELECT + " WHERE lower(u.email) = lower(:email)")
			.param("email", email)
			.query((rs, i) -> user(rs))
			.optional();
	}

	public Optional<UserRow> userById(UUID id) {
		return jdbc.sql(USER_SELECT + " WHERE u.id = :id").param("id", id).query((rs, i) -> user(rs)).optional();
	}

	public List<String> permissionsOf(String role) {
		return jdbc.sql("SELECT permission_code FROM role_permissions WHERE role_code = :role ORDER BY 1")
			.param("role", role)
			.query(String.class)
			.list();
	}

	public void markLogin(UUID userId) {
		jdbc.sql("UPDATE users SET last_login_at = now() WHERE id = :id").param("id", userId).update();
	}

	// ---------------------------------------------------------------- TOTP

	public Optional<TotpRow> totp(UUID userId) {
		return jdbc.sql("SELECT secret_encrypted, confirmed_at IS NOT NULL AS confirmed, last_step FROM user_totp WHERE user_id = :id")
			.param("id", userId)
			.query((rs, i) -> new TotpRow(rs.getString(1), rs.getBoolean(2), rs.getLong(3)))
			.optional();
	}

	/** Cadastro (ou recadastro) ainda não confirmado do app autenticador. */
	public void saveUnconfirmedTotp(UUID userId, String secretEncrypted) {
		jdbc.sql("""
				INSERT INTO user_totp (user_id, secret_encrypted) VALUES (:id, :secret)
				ON CONFLICT (user_id) DO UPDATE SET secret_encrypted = :secret, confirmed_at = NULL, last_step = 0
				WHERE user_totp.confirmed_at IS NULL""")
			.param("id", userId)
			.param("secret", secretEncrypted)
			.update();
	}

	public void useTotpStep(UUID userId, long step, boolean confirm) {
		jdbc.sql("UPDATE user_totp SET last_step = :step"
				+ (confirm ? ", confirmed_at = coalesce(confirmed_at, now())" : "") + " WHERE user_id = :id")
			.param("id", userId)
			.param("step", step)
			.update();
	}

	// ---------------------------------------------------------------- desafios (2ª etapa)

	public void createChallenge(byte[] tokenHash, UUID userId, boolean setup, OffsetDateTime expiresAt, String ip) {
		jdbc.sql("""
				INSERT INTO login_challenges (token_hash, user_id, setup, expires_at, ip)
				VALUES (:hash, :user, :setup, :expires, :ip)""")
			.param("hash", tokenHash)
			.param("user", userId)
			.param("setup", setup)
			.param("expires", expiresAt)
			.param("ip", ip)
			.update();
	}

	public Optional<ChallengeRow> challenge(byte[] tokenHash) {
		return jdbc.sql("SELECT id, user_id, setup, attempts, expires_at, used_at FROM login_challenges WHERE token_hash = :hash")
			.param("hash", tokenHash)
			.query((rs, i) -> new ChallengeRow(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
					rs.getBoolean(3), rs.getInt(4), rs.getObject(5, OffsetDateTime.class),
					rs.getObject(6, OffsetDateTime.class)))
			.optional();
	}

	public void failChallenge(UUID id) {
		jdbc.sql("UPDATE login_challenges SET attempts = attempts + 1 WHERE id = :id").param("id", id).update();
	}

	public void useChallenge(UUID id) {
		jdbc.sql("UPDATE login_challenges SET used_at = now() WHERE id = :id").param("id", id).update();
	}

	// ---------------------------------------------------------------- sessões

	public void createSession(byte[] tokenHash, UUID userId, OffsetDateTime expiresAt, String ip, String userAgent) {
		jdbc.sql("""
				INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent)
				VALUES (:hash, :user, :expires, :ip, :ua)""")
			.param("hash", tokenHash)
			.param("user", userId)
			.param("expires", expiresAt)
			.param("ip", ip)
			.param("ua", userAgent)
			.update();
	}

	public Optional<SessionRow> session(byte[] tokenHash) {
		return jdbc.sql("SELECT id, user_id, last_seen_at, expires_at, revoked_at FROM sessions WHERE token_hash = :hash")
			.param("hash", tokenHash)
			.query((rs, i) -> new SessionRow(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
					rs.getObject(3, OffsetDateTime.class), rs.getObject(4, OffsetDateTime.class),
					rs.getObject(5, OffsetDateTime.class)))
			.optional();
	}

	public void touchSession(UUID id) {
		jdbc.sql("UPDATE sessions SET last_seen_at = now() WHERE id = :id").param("id", id).update();
	}

	public void revokeSession(byte[] tokenHash) {
		jdbc.sql("UPDATE sessions SET revoked_at = now() WHERE token_hash = :hash AND revoked_at IS NULL")
			.param("hash", tokenHash)
			.update();
	}

	/** Troca de senha, de perfil ou desativação derrubam todas as sessões da pessoa. */
	public int revokeAllSessions(UUID userId) {
		return jdbc.sql("UPDATE sessions SET revoked_at = now() WHERE user_id = :id AND revoked_at IS NULL")
			.param("id", userId)
			.update();
	}

	// ---------------------------------------------------------------- tentativas

	public void recordAttempt(String email, String ip, boolean success) {
		jdbc.sql("INSERT INTO login_attempts (email, ip, success) VALUES (lower(:email), :ip, :success)")
			.param("email", email)
			.param("ip", ip)
			.param("success", success)
			.update();
	}

	/** Falhas seguidas do e-mail desde o último acerto, dentro da janela. */
	public int recentFailuresForEmail(String email, OffsetDateTime since) {
		return jdbc.sql("""
				SELECT count(*) FROM login_attempts
				WHERE email = lower(:email) AND NOT success AND created_at > :since
				  AND created_at > coalesce((SELECT max(created_at) FROM login_attempts
				                             WHERE email = lower(:email) AND success), '-infinity')""")
			.param("email", email)
			.param("since", since)
			.query(Integer.class)
			.single();
	}

	/** Falhas do IP na janela (protege contra tentar muitos e-mails do mesmo lugar). */
	public int recentFailuresForIp(String ip, OffsetDateTime since) {
		if (ip == null) {
			return 0;
		}
		return jdbc.sql("SELECT count(*) FROM login_attempts WHERE ip = :ip AND NOT success AND created_at > :since")
			.param("ip", ip)
			.param("since", since)
			.query(Integer.class)
			.single();
	}

	private static UserRow user(java.sql.ResultSet rs) throws java.sql.SQLException {
		return new UserRow(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("email"),
				rs.getString("password_hash"), rs.getString("role_code"), rs.getString("status"),
				rs.getBoolean("requires_totp"), rs.getString("author_slug"));
	}

}
