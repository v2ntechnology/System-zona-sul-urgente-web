package br.com.zonasulurgente.api.instagram;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import br.com.zonasulurgente.api.audit.AuditAction;
import br.com.zonasulurgente.api.audit.AuditEvent;
import br.com.zonasulurgente.api.audit.AuditLog;
import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.auth.application.SecretCipher;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.AccessRevokedException;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.Account;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.GraphRejectedException;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.TransientGraphException;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.InvalidFieldsException;

/**
 * Conta do Instagram ligada ao painel (BE-013, spec 001, História 1). O Administrador cola o ID da conta e o acesso
 * gerado no painel da Meta; a conta é conferida na Meta antes de gravar e o acesso fica cifrado (mesma chave do 2FA).
 * O acesso nunca volta na resposta, em log ou na auditoria — só os 4 últimos caracteres, para reconhecer qual é.
 */
@Service
public class InstagramConnectionService {

	/** Aviso para a tela. {@code kind}: REVOKED, FAILING ou EXPIRING. */
	public record Alert(String kind, String message) {
	}

	/** Situação da conexão — contrato em specs/001-conexao-instagram/contracts. */
	public record ConnectionView(String username, String igUserId, String status, OffsetDateTime connectedAt,
			String connectedBy, OffsetDateTime lastCheckAt, OffsetDateTime lastSuccessAt, long pollMinutes,
			String tokenLast4, OffsetDateTime tokenExpiresAt, Long tokenDaysLeft, Alert alert) {
	}

	/** Conta ativa com o acesso já decifrado — uso interno da sincronização. */
	record Active(String igUserId, String username, String token, OffsetDateTime backfillSince,
			OffsetDateTime lastSuccessAt) {
	}

	private static final Pattern ACCOUNT_ID = Pattern.compile("\\d{5,30}");
	private static final Duration EXPIRING = Duration.ofDays(10);

	private final InstagramRepository repo;
	private final InstagramGraphClient graph;
	private final SecretCipher cipher;
	private final InstagramProperties props;
	private final AuditLog audit;
	private final TransactionTemplate tx;

	public InstagramConnectionService(InstagramRepository repo, InstagramGraphClient graph, SecretCipher cipher,
			InstagramProperties props, AuditLog audit, TransactionTemplate tx) {
		this.repo = repo;
		this.graph = graph;
		this.cipher = cipher;
		this.props = props;
		this.audit = audit;
		this.tx = tx;
	}

	public Optional<ConnectionView> view() {
		return repo.connection().map(this::toView);
	}

	/** Liga ou troca a conta. Confere na Meta antes de gravar; a fila e as notícias da conta anterior ficam. */
	public ConnectionView connect(String igUserId, String accessToken, AuthenticatedUser user) {
		String id = igUserId == null ? "" : igUserId.strip();
		String token = accessToken == null ? "" : accessToken.strip();
		Map<String, String> errors = new LinkedHashMap<>();
		if (!ACCOUNT_ID.matcher(id).matches()) {
			errors.put("igUserId", "Informe o ID da conta do Instagram (só números, como aparece no painel da Meta).");
		}
		if (token.isEmpty()) {
			errors.put("accessToken", "Cole o acesso gerado no painel da Meta.");
		}
		else if (token.length() > 1000 || token.chars().anyMatch(Character::isWhitespace)) {
			errors.put("accessToken", "O acesso colado não parece válido. Copie de novo pelo botão do painel da Meta.");
		}
		if (!errors.isEmpty()) {
			throw new InvalidFieldsException(errors);
		}

		Account account = check(id, token);
		String cipherText = cipher.encrypt(token);
		String last4 = token.substring(token.length() - Math.min(4, token.length()));
		OffsetDateTime backfillSince = OffsetDateTime.now(ZoneOffset.UTC).minus(props.backfill());
		tx.executeWithoutResult(status -> {
			String previous = repo.connection().map(c -> "@" + c.username()).orElse(null);
			repo.saveConnection(id, account.username(), cipherText, last4, null, user.id(), backfillSince);
			audit.record(AuditEvent.of(AuditAction.INSTAGRAM_CONNECT, "instagram_connection", id,
					"@" + account.username())
				.detail("previous", previous), AuditLog.Actor.of(user));
		});
		return view().orElseThrow();
	}

	/** Desliga: a varredura para; posts e notícias continuam. */
	public void disconnect(AuthenticatedUser user) {
		tx.executeWithoutResult(status -> repo.connection().ifPresent(c -> {
			repo.deleteConnection();
			audit.record(AuditEvent.of(AuditAction.INSTAGRAM_DISCONNECT, "instagram_connection", c.igUserId(),
					"@" + c.username()), AuditLog.Actor.of(user));
		}));
	}

	/** Conta ativa para a sincronização (vazio = nada a fazer). */
	Optional<Active> active() {
		return repo.connection()
			.filter(c -> "ACTIVE".equals(c.status()))
			.map(c -> new Active(c.igUserId(), c.username(), cipher.decrypt(c.tokenCipher()), c.backfillSince(),
					c.lastSuccessAt()));
	}

	private Account check(String igUserId, String token) {
		try {
			Account account = graph.account(igUserId, token);
			if (!igUserId.equals(account.id()) || account.username().isBlank()) {
				throw new GraphRejectedException("Conta diferente da informada.", 0);
			}
			return account;
		}
		catch (AccessRevokedException e) {
			throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "Não foi possível ligar a conta",
					"A Meta não aceitou este acesso. Confira se ele foi copiado inteiro, se é do app do painel e se a "
							+ "conta é profissional e está no portfólio da empresa.");
		}
		catch (GraphRejectedException e) {
			throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "Não foi possível ligar a conta",
					"A Meta não encontrou a conta " + igUserId + " com este acesso. Confira o ID da conta do "
							+ "Instagram no painel da Meta.");
		}
		catch (TransientGraphException e) {
			throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "A Meta não respondeu",
					"Não deu para conferir a conta agora. Tente de novo em alguns minutos.");
		}
	}

	private ConnectionView toView(InstagramRepository.Connection c) {
		Long daysLeft = c.tokenExpiresAt() == null ? null
				: Math.max(0, Duration.between(OffsetDateTime.now(ZoneOffset.UTC), c.tokenExpiresAt()).toDays());
		return new ConnectionView(c.username(), c.igUserId(), c.status(), c.connectedAt(), c.connectedByName(),
				c.lastSyncAt(), c.lastSuccessAt(), props.syncInterval().toMinutes(), c.tokenLast4(),
				c.tokenExpiresAt(), daysLeft, alert(c, daysLeft));
	}

	private Alert alert(InstagramRepository.Connection c, Long daysLeft) {
		if ("REVOKED".equals(c.status())) {
			return new Alert("REVOKED", "O acesso à conta @" + c.username() + " deixou de funcionar (revogado ou "
					+ "removido no painel da Meta). Gere um acesso novo e ligue a conta de novo. Até lá, os posts "
					+ "podem ser adicionados à mão.");
		}
		if (c.failures() >= props.failuresBeforeAlert()) {
			return new Alert("FAILING", "A sincronização falhou nas últimas " + c.failures() + " tentativas"
					+ (c.lastError() == null ? "." : ": " + c.lastError())
					+ " Os posts novos entram quando a Meta voltar a responder.");
		}
		if (daysLeft != null && daysLeft <= EXPIRING.toDays()) {
			return new Alert("EXPIRING", "O acesso à conta vence em " + daysLeft + " dia(s). Gere um acesso novo no "
					+ "painel da Meta e ligue a conta de novo.");
		}
		return null;
	}

}
