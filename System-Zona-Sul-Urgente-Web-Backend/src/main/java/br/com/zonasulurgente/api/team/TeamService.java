package br.com.zonasulurgente.api.team;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.auth.application.Tokens;
import br.com.zonasulurgente.api.auth.infrastructure.AuthRepository;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.InvalidFieldsException;
import br.com.zonasulurgente.api.shared.web.NotFoundException;

/**
 * Equipe do painel (FE-159). Regras de src/lib/team/validate.ts: ninguém mexe no próprio
 * acesso e sempre sobra um Administrador ativo. Trocar perfil, desativar e zerar o 2FA
 * derrubam as sessões da pessoa. Convite por link (sem e-mail ainda): a API devolve o token
 * e o painel monta o link para o administrador mandar.
 */
@Service
public class TeamService {

	public static final Duration INVITE_TTL = Duration.ofDays(7);
	static final Set<String> ROLES = Set.of("ADMIN", "EDITOR", "REPORTER", "AUTOR", "COMERCIAL");
	private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

	/** Cargo na assinatura do autor criado junto com o convite (editável em Autores). */
	private static final Map<String, String> AUTHOR_ROLE = Map.of("ADMIN", "Redação", "EDITOR", "Editor",
			"REPORTER", "Repórter", "AUTOR", "Colunista");

	public record Invited(List<TeamMember> team, String inviteToken, OffsetDateTime expiresAt) {
	}

	public record InviteInput(String name, String email, String role, boolean createAuthor) {
	}

	private final JdbcClient jdbc;
	private final AuthRepository auth;
	private final AuthorService authors;

	TeamService(JdbcClient jdbc, AuthRepository auth, AuthorService authors) {
		this.jdbc = jdbc;
		this.auth = auth;
		this.authors = authors;
	}

	@Transactional(readOnly = true)
	public List<TeamMember> list() {
		return jdbc.sql("""
				SELECT u.id, u.name, u.email, u.role_code, u.status, (t.confirmed_at IS NOT NULL) AS two_factor,
				       u.last_login_at, CASE WHEN u.status = 'INVITED' THEN u.created_at END AS invited_at, a.slug
				FROM users u
				LEFT JOIN user_totp t ON t.user_id = u.id
				LEFT JOIN authors a ON a.id = u.author_id
				ORDER BY CASE u.status WHEN 'ACTIVE' THEN 0 WHEN 'INVITED' THEN 1 ELSE 2 END, u.name""")
			.query((rs, i) -> new TeamMember(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("email"),
					rs.getString("role_code"), rs.getString("status"), rs.getBoolean("two_factor"),
					rs.getObject("last_login_at", OffsetDateTime.class),
					rs.getObject("invited_at", OffsetDateTime.class), rs.getString("slug")))
			.list();
	}

	@Transactional
	public Invited invite(InviteInput in, AuthenticatedUser actor) {
		Map<String, String> e = new LinkedHashMap<>();
		String name = in.name() == null ? "" : in.name().strip().replaceAll("\\s+", " ");
		String email = in.email() == null ? "" : in.email().strip().toLowerCase();
		if (name.split(" ").length < 2) {
			e.put("name", "Informe nome e sobrenome.");
		}
		if (!EMAIL.matcher(email).matches()) {
			e.put("email", "E-mail inválido.");
		}
		else if (jdbc.sql("SELECT EXISTS (SELECT 1 FROM users WHERE lower(email) = :email)").param("email", email)
			.query(Boolean.class).single()) {
			e.put("email", "Essa pessoa já está na equipe (ou já foi convidada).");
		}
		if (in.role() == null || !ROLES.contains(in.role())) {
			e.put("role", "Escolha o perfil de acesso.");
		}
		if (!e.isEmpty()) {
			throw new InvalidFieldsException(e);
		}
		// Comercial não assina matérias (só patrocinadas, com o nome do patrocinador).
		UUID authorId = in.createAuthor() && !"COMERCIAL".equals(in.role())
				? authors.insert(name, AUTHOR_ROLE.get(in.role()), null, null)
				: null;
		UUID userId = jdbc.sql("""
				INSERT INTO users (name, email, role_code, status, author_id)
				VALUES (:name, :email, :role, 'INVITED', :author) RETURNING id""")
			.param("name", name)
			.param("email", email)
			.param("role", in.role())
			.param("author", authorId)
			.query(UUID.class)
			.single();
		return newInvitation(userId, actor);
	}

	/** Link novo para quem ainda não aceitou (o anterior deixa de valer). */
	@Transactional
	public Invited reinvite(UUID id, AuthenticatedUser actor) {
		TeamMember member = member(id);
		if (!"INVITED".equals(member.status())) {
			throw new ApiException(HttpStatus.CONFLICT, "Convite já aceito",
					member.name() + " já tem acesso; não precisa de convite.");
		}
		return newInvitation(id, actor);
	}

	@Transactional
	public List<TeamMember> changeRole(UUID id, String role, AuthenticatedUser actor) {
		if (role == null || !ROLES.contains(role)) {
			throw new InvalidFieldsException(Map.of("role", "Perfil inválido."));
		}
		TeamMember member = member(id);
		guard(actor, member, !"ADMIN".equals(role));
		jdbc.sql("UPDATE users SET role_code = :role, updated_at = now() WHERE id = :id")
			.param("role", role)
			.param("id", id)
			.update();
		auth.revokeAllSessions(id);
		return list();
	}

	/** Desativar tira o acesso na hora; reativar devolve (ou volta a "convidado" se nunca entrou). */
	@Transactional
	public List<TeamMember> setActive(UUID id, boolean active, AuthenticatedUser actor) {
		TeamMember member = member(id);
		if (!active) {
			guard(actor, member, true);
		}
		else if (actor.id().equals(id)) {
			throw selfChange();
		}
		jdbc.sql("""
				UPDATE users SET status = CASE WHEN NOT :active THEN 'DISABLED'
				                               WHEN password_hash IS NULL THEN 'INVITED' ELSE 'ACTIVE' END,
				  updated_at = now() WHERE id = :id""")
			.param("active", active)
			.param("id", id)
			.update();
		if (!active) {
			auth.revokeAllSessions(id);
			jdbc.sql("DELETE FROM user_invitations WHERE user_id = :id AND used_at IS NULL").param("id", id).update();
		}
		return list();
	}

	/** Celular perdido/trocado: configura o app autenticador de novo no próximo acesso. */
	@Transactional
	public List<TeamMember> resetTwoFactor(UUID id) {
		member(id);
		jdbc.sql("DELETE FROM user_totp WHERE user_id = :id").param("id", id).update();
		auth.revokeAllSessions(id);
		return list();
	}

	// ---------------------------------------------------------------- internos

	private Invited newInvitation(UUID userId, AuthenticatedUser actor) {
		jdbc.sql("DELETE FROM user_invitations WHERE user_id = :id AND used_at IS NULL").param("id", userId).update();
		String token = Tokens.newToken();
		OffsetDateTime expires = OffsetDateTime.now(ZoneOffset.UTC).plus(INVITE_TTL);
		jdbc.sql("""
				INSERT INTO user_invitations (user_id, token_hash, expires_at, created_by)
				VALUES (:user, :hash, :expires, :actor)""")
			.param("user", userId)
			.param("hash", Tokens.hash(token))
			.param("expires", expires)
			.param("actor", actor.id())
			.update();
		return new Invited(list(), token, expires);
	}

	/** Ninguém mexe no próprio acesso; não pode sobrar zero Administrador ativo. */
	private void guard(AuthenticatedUser actor, TeamMember target, boolean losesAdminIfAdmin) {
		if (actor.id().equals(target.id())) {
			throw selfChange();
		}
		if ("ADMIN".equals(target.role()) && "ACTIVE".equals(target.status()) && losesAdminIfAdmin) {
			long admins = jdbc.sql("SELECT count(*) FROM users WHERE role_code = 'ADMIN' AND status = 'ACTIVE'")
				.query(Long.class).single();
			if (admins <= 1) {
				throw new ApiException(HttpStatus.CONFLICT, "Último administrador",
						"Precisa sobrar pelo menos um Administrador ativo.");
			}
		}
	}

	private TeamMember member(UUID id) {
		return list().stream().filter(m -> m.id().equals(id)).findFirst()
			.orElseThrow(() -> new NotFoundException("Pessoa não encontrada na equipe."));
	}

	private static ApiException selfChange() {
		return new ApiException(HttpStatus.CONFLICT, "Seu próprio acesso",
				"Você não pode alterar o seu próprio acesso.");
	}

}
