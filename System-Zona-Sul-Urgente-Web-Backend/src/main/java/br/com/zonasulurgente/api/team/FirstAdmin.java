package br.com.zonasulurgente.api.team;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.audit.AuditAction;
import br.com.zonasulurgente.api.audit.AuditDiff;
import br.com.zonasulurgente.api.audit.AuditEvent;
import br.com.zonasulurgente.api.audit.AuditLog;
import br.com.zonasulurgente.api.auth.application.Tokens;

/**
 * Primeiro administrador num servidor novo: o banco começa vazio e convites só saem do painel, por um
 * Admin. Com {@code ZSU_BOOTSTRAP_ADMIN_EMAIL} e NENHUM Admin ativo, ao subir a API cria o convite de
 * Administrador e mostra o link no log (7 dias, uso único — o mesmo fluxo de /admin/convite). Cada
 * reinício antes do aceite gera um link novo e invalida o anterior. Com um Admin ativo, não faz nada:
 * a variável esquecida no servidor não abre brecha. Depois do aceite, pode apagar a variável.
 */
@Component
class FirstAdmin implements ApplicationRunner {

	private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
	private static final Logger log = LoggerFactory.getLogger(FirstAdmin.class);

	private final FirstAdminProperties props;
	private final JdbcClient jdbc;
	private final AuditLog audit;

	FirstAdmin(FirstAdminProperties props, JdbcClient jdbc, AuditLog audit) {
		this.props = props;
		this.jdbc = jdbc;
		this.audit = audit;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		ensure().ifPresent(token -> log.warn("""
				Primeiro administrador: convite para {} (vale 7 dias, uso único). Abra o link, crie a senha e \
				cadastre o app autenticador; depois convide o resto da equipe pelo painel:
				{}""", props.email().strip().toLowerCase(), link(token)));
	}

	/** Token do convite gerado agora, ou vazio quando não há o que fazer. */
	@Transactional
	Optional<String> ensure() {
		String email = props.email().strip().toLowerCase();
		if (email.isEmpty()) {
			return Optional.empty();
		}
		if (!EMAIL.matcher(email).matches()) {
			throw new IllegalStateException("ZSU_BOOTSTRAP_ADMIN_EMAIL inválido: " + email);
		}
		boolean hasActiveAdmin = jdbc.sql("SELECT EXISTS (SELECT 1 FROM users WHERE role_code = 'ADMIN' AND status = 'ACTIVE')")
			.query(Boolean.class)
			.single();
		if (hasActiveAdmin) {
			log.info("Primeiro administrador: já existe Administrador ativo; ZSU_BOOTSTRAP_ADMIN_EMAIL ignorado.");
			return Optional.empty();
		}
		var existing = jdbc.sql("SELECT id, role_code, status FROM users WHERE lower(email) = :email")
			.param("email", email)
			.query((rs, i) -> new Object[] { rs.getObject("id", UUID.class), rs.getString("role_code"),
					rs.getString("status") })
			.optional();
		UUID userId;
		if (existing.isEmpty()) {
			String name = props.name().strip().replaceAll("\\s+", " ");
			userId = jdbc.sql("""
					INSERT INTO users (name, email, role_code, status)
					VALUES (:name, :email, 'ADMIN', 'INVITED') RETURNING id""")
				.param("name", name)
				.param("email", email)
				.query(UUID.class)
				.single();
			audit.recordSystem(AuditEvent.of(AuditAction.INVITE, "user", userId, name)
				.withDiff(AuditDiff.created(Map.<String, Object>of("name", name, "email", email, "role", "ADMIN")))
				.detail("firstAdmin", true));
		}
		else if ("ADMIN".equals(existing.get()[1]) && "INVITED".equals(existing.get()[2])) {
			userId = (UUID) existing.get()[0];
			audit.recordSystem(AuditEvent.of(AuditAction.INVITE, "user", userId, email)
				.detail("firstAdmin", true)
				.detail("reinvite", true));
		}
		else {
			// Conta existente com outro perfil/estado: promover alguém é decisão humana, não de variável.
			log.warn("Primeiro administrador: {} já existe ({} {}); nada foi alterado.", email, existing.get()[1],
					existing.get()[2]);
			return Optional.empty();
		}
		jdbc.sql("DELETE FROM user_invitations WHERE user_id = :id AND used_at IS NULL").param("id", userId).update();
		String token = Tokens.newToken();
		jdbc.sql("""
				INSERT INTO user_invitations (user_id, token_hash, expires_at)
				VALUES (:user, :hash, :expires)""")
			.param("user", userId)
			.param("hash", Tokens.hash(token))
			.param("expires", OffsetDateTime.now(ZoneOffset.UTC).plus(TeamService.INVITE_TTL))
			.update();
		return Optional.of(token);
	}

	private String link(String token) {
		return props.siteUrl().replaceAll("/+$", "") + "/admin/convite/" + token;
	}

}
