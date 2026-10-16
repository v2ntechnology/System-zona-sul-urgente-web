package br.com.zonasulurgente.api.auth.application;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.auth.config.AuthProperties;
import br.com.zonasulurgente.api.auth.infrastructure.AuthRepository;
import br.com.zonasulurgente.api.auth.infrastructure.AuthRepository.ChallengeRow;
import br.com.zonasulurgente.api.auth.infrastructure.AuthRepository.SessionRow;
import br.com.zonasulurgente.api.auth.infrastructure.AuthRepository.TotpRow;
import br.com.zonasulurgente.api.auth.infrastructure.AuthRepository.UserRow;
import br.com.zonasulurgente.api.shared.web.ApiException;

/**
 * Login do painel em duas etapas (BE-006, ARCHITECTURE §8): e-mail + senha; depois o código
 * do app autenticador (obrigatório para os perfis com requires_totp; no primeiro acesso, o
 * mesmo passo cadastra o app). Sessão opaca de 256 bits (só o hash no banco), 12 h sem uso
 * ou 7 dias no total. 5 falhas seguidas bloqueiam o e-mail por 15 min.
 */
@Service
public class AuthService {

	public enum Status {
		AUTHENTICATED, MFA_REQUIRED, MFA_SETUP_REQUIRED
	}

	public record Session(String token, OffsetDateTime expiresAt) {
	}

	public record TotpSetup(String secret, String otpauthUri) {
	}

	/** Resposta do login: sessão pronta, ou desafio para a 2ª etapa (com o cadastro do app, se for o caso). */
	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record LoginResult(Status status, Session session, String challenge, OffsetDateTime challengeExpiresAt,
			TotpSetup totpSetup) {
	}

	private static final int MAX_CODE_ATTEMPTS = 5;
	/** Uma vez por minuto basta para o "último uso" (evita escrita a cada requisição). */
	private static final long TOUCH_AFTER_SECONDS = 60;

	private final AuthRepository repo;
	private final PasswordEncoder passwords;
	private final SecretCipher cipher;
	private final AuthProperties props;
	/** Hash de uma senha qualquer: e-mail inexistente custa o mesmo tempo (não revela quem existe). */
	private final String dummyHash;

	public AuthService(AuthRepository repo, PasswordEncoder passwords, SecretCipher cipher, AuthProperties props) {
		this.repo = repo;
		this.passwords = passwords;
		this.cipher = cipher;
		this.props = props;
		this.dummyHash = passwords.encode("senha-que-nao-existe");
	}

	// A falha precisa ficar gravada (bloqueio progressivo): não desfaz ao lançar o erro.
	@Transactional(noRollbackFor = ApiException.class)
	public LoginResult login(String email, String password, String ip, String userAgent) {
		OffsetDateTime since = now().minus(props.lockout());
		if (repo.recentFailuresForEmail(email, since) >= props.maxFailures()
				|| repo.recentFailuresForIp(ip, since) >= props.maxFailures() * 4) {
			throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas",
					"Por segurança, espere 15 minutos para tentar de novo.");
		}
		Optional<UserRow> found = repo.userByEmail(email);
		boolean ok = found.filter(u -> "ACTIVE".equals(u.status()) && u.passwordHash() != null)
			.map(u -> passwords.matches(password, u.passwordHash()))
			.orElseGet(() -> passwords.matches(password, dummyHash) && false);
		repo.recordAttempt(email, ip, ok);
		if (!ok) {
			// Mesma mensagem para e-mail inexistente, senha errada ou conta desativada.
			throw new ApiException(HttpStatus.UNAUTHORIZED, "Não foi possível entrar", "E-mail ou senha incorretos.");
		}
		UserRow user = found.get();
		Optional<TotpRow> totp = repo.totp(user.id());
		if (totp.isPresent() && totp.get().confirmed()) {
			return challenge(user, false, null, ip);
		}
		if (user.requiresTotp()) {
			String secret = Totp.newSecret();
			repo.saveUnconfirmedTotp(user.id(), cipher.encrypt(secret));
			// Se havia um cadastro pendente, saveUnconfirmedTotp trocou o segredo: usa o atual.
			String current = cipher.decrypt(repo.totp(user.id()).orElseThrow().secretEncrypted());
			return challenge(user, true,
					new TotpSetup(current, Totp.otpauthUri(props.totpIssuer(), user.email(), current)), ip);
		}
		return new LoginResult(Status.AUTHENTICATED, createSession(user, ip, userAgent), null, null, null);
	}

	@Transactional(noRollbackFor = ApiException.class)
	public LoginResult verifyCode(String challengeToken, String code, String ip, String userAgent) {
		ChallengeRow challenge = repo.challenge(Tokens.hash(challengeToken))
			.filter(c -> c.usedAt() == null && c.expiresAt().isAfter(now()) && c.attempts() < MAX_CODE_ATTEMPTS)
			.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Código expirado",
					"O tempo para digitar o código acabou. Entre de novo."));
		UserRow user = repo.userById(challenge.userId())
			.filter(u -> "ACTIVE".equals(u.status()))
			.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Não foi possível entrar", "Conta indisponível."));
		TotpRow totp = repo.totp(user.id()).orElseThrow();
		long step = Totp.verify(cipher.decrypt(totp.secretEncrypted()), code, Instant.now(), totp.lastStep());
		if (step < 0) {
			repo.failChallenge(challenge.id());
			throw new ApiException(HttpStatus.UNAUTHORIZED, "Código incorreto",
					"Confira o código de 6 números no app autenticador.");
		}
		repo.useTotpStep(user.id(), step, challenge.setup());
		repo.useChallenge(challenge.id());
		return new LoginResult(Status.AUTHENTICATED, createSession(user, ip, userAgent), null, null, null);
	}

	/** Valida o token do cookie (repassado pelo Next como Bearer). */
	@Transactional
	public Optional<AuthenticatedUser> authenticate(String token) {
		Optional<SessionRow> found = repo.session(Tokens.hash(token));
		if (found.isEmpty()) {
			return Optional.empty();
		}
		SessionRow session = found.get();
		OffsetDateTime now = now();
		if (session.revokedAt() != null || !session.expiresAt().isAfter(now)
				|| session.lastSeenAt().plus(props.sessionIdle()).isBefore(now)) {
			return Optional.empty();
		}
		Optional<UserRow> user = repo.userById(session.userId()).filter(u -> "ACTIVE".equals(u.status()));
		if (user.isEmpty()) {
			return Optional.empty();
		}
		if (session.lastSeenAt().plusSeconds(TOUCH_AFTER_SECONDS).isBefore(now)) {
			repo.touchSession(session.id());
		}
		UserRow u = user.get();
		return Optional.of(new AuthenticatedUser(u.id(), u.name(), u.email(), u.role(), repo.permissionsOf(u.role()),
				u.authorSlug(), session.id()));
	}

	@Transactional
	public void logout(String token) {
		repo.revokeSession(Tokens.hash(token));
	}

	@Transactional
	public int revokeAll(UUID userId) {
		return repo.revokeAllSessions(userId);
	}

	private LoginResult challenge(UserRow user, boolean setup, TotpSetup totpSetup, String ip) {
		String token = Tokens.newToken();
		OffsetDateTime expires = now().plus(props.challengeTtl());
		repo.createChallenge(Tokens.hash(token), user.id(), setup, expires, ip);
		return new LoginResult(setup ? Status.MFA_SETUP_REQUIRED : Status.MFA_REQUIRED, null, token, expires,
				totpSetup);
	}

	private Session createSession(UserRow user, String ip, String userAgent) {
		String token = Tokens.newToken();
		OffsetDateTime expires = now().plus(props.sessionMax());
		repo.createSession(Tokens.hash(token), user.id(), expires, ip,
				userAgent == null ? null : userAgent.substring(0, Math.min(300, userAgent.length())));
		repo.markLogin(user.id());
		return new Session(token, expires);
	}

	private static OffsetDateTime now() {
		return OffsetDateTime.now(ZoneOffset.UTC);
	}

}
