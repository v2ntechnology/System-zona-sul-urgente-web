package br.com.zonasulurgente.api.instagram;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.HtmlUtils;

import br.com.zonasulurgente.api.ai.AiDraft;
import br.com.zonasulurgente.api.ai.EditorialAiProvider;
import br.com.zonasulurgente.api.ai.EditorialContext;
import br.com.zonasulurgente.api.ai.SourcePost;
import br.com.zonasulurgente.api.audit.AuditAction;
import br.com.zonasulurgente.api.audit.AuditDiff;
import br.com.zonasulurgente.api.audit.AuditEvent;
import br.com.zonasulurgente.api.audit.AuditLog;
import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.jobs.JobQueue;
import br.com.zonasulurgente.api.news.admin.AdminNewsService;
import br.com.zonasulurgente.api.news.admin.NewsDraft;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.InvalidFieldsException;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import br.com.zonasulurgente.api.usage.QuotaDeferredException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Fila do Instagram (FE-155): importação manual (enquanto não há app da Meta), geração do rascunho pela IA
 * (BE-014) e as ações de revisão. 1 post → no máximo 1 notícia, sempre em rascunho (ARCHITECTURE §6).
 * Importação, geração pela IA (AI_GENERATION, com o modelo) e ignorar/restaurar vão para a auditoria (BE-008).
 */
@Service
public class InstagramQueueService {

	/** Limite de legenda do próprio Instagram. */
	static final int CAPTION_MAX = 2200;

	private static final Pattern PERMALINK = Pattern
		.compile("^https?://(?:www\\.)?instagram\\.com/(?:[\\w.]+/)?(p|reel|tv)/([A-Za-z0-9_-]{5,40})/?(?:[?#].*)?$");

	/** Estados em que dá para pedir (ou repedir) o rascunho à IA. */
	private static final Set<String> CAN_GENERATE = Set.of("NEW", "ERROR");

	private static final Logger log = LoggerFactory.getLogger(InstagramQueueService.class);

	private final InstagramRepository repo;
	private final EditorialAiProvider ai;
	private final AdminNewsService news;
	private final TransactionTemplate tx;
	private final JsonMapper json;
	private final AuditLog audit;
	private final JobQueue jobs;

	public InstagramQueueService(InstagramRepository repo, EditorialAiProvider ai, AdminNewsService news,
			TransactionTemplate tx, JsonMapper json, AuditLog audit, JobQueue jobs) {
		this.jobs = jobs;
		this.repo = repo;
		this.ai = ai;
		this.news = news;
		this.tx = tx;
		this.json = json;
		this.audit = audit;
	}

	/**
	 * Link canônico do post ({@code https://www.instagram.com/{p|reel|tv}/{codigo}/}) — o mesmo formato que a Meta
	 * devolve. É a chave que liga a importação manual à sincronização (spec 001, R6). Vazio se não for link de post.
	 */
	static java.util.Optional<String> canonicalPermalink(String url) {
		Matcher m = url == null ? null : PERMALINK.matcher(url.strip());
		return m == null || !m.matches() ? java.util.Optional.empty()
				: java.util.Optional.of("https://www.instagram.com/" + m.group(1) + "/" + m.group(2) + "/");
	}

	public List<InstagramPostView> list(String status) {
		return repo.list(status);
	}

	public Map<String, Long> counts() {
		return repo.counts();
	}

	/** Post colado no painel (link + legenda). O código do link vira o ID (deduplicação). */
	@Transactional
	public InstagramPostView importManual(String url, String caption, OffsetDateTime postedAt,
			AuthenticatedUser user) {
		Map<String, String> errors = new java.util.LinkedHashMap<>();
		Matcher m = url == null ? null : PERMALINK.matcher(url.strip());
		if (m == null || !m.matches()) {
			errors.put("url", "Cole o link do post (instagram.com/p/... ou /reel/...).");
		}
		String text = caption == null ? "" : caption.strip();
		if (text.isEmpty()) {
			errors.put("caption", "Cole a legenda do post.");
		}
		else if (text.length() > CAPTION_MAX) {
			errors.put("caption", "Máximo de " + CAPTION_MAX + " caracteres (limite do Instagram).");
		}
		if (postedAt != null && postedAt.isAfter(OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(5))) {
			errors.put("postedAt", "A data do post não pode estar no futuro.");
		}
		if (!errors.isEmpty()) {
			throw new InvalidFieldsException(errors);
		}
		String kind = m.group(1);
		String code = m.group(2);
		String permalink = "https://www.instagram.com/" + kind + "/" + code + "/";
		if (repo.exists(code, permalink)) {
			throw new ApiException(HttpStatus.CONFLICT, "Post já está na fila", "Este post já foi adicionado.");
		}
		repo.insertManual(code, text, permalink, "p".equals(kind) ? "IMAGE" : "VIDEO",
				postedAt == null ? OffsetDateTime.now(ZoneOffset.UTC) : postedAt, user.id());
		audit.record(AuditEvent.of(AuditAction.INSTAGRAM_IMPORT, "instagram_post", code, permalink)
			.withDiff(AuditDiff.created(Map.of("permalink", permalink, "caption", text)))
			.detail("source", "MANUAL"), AuditLog.Actor.of(user));
		return repo.view(code).orElseThrow();
	}

	/**
	 * Pede o rascunho à IA e cria a notícia (origem INSTAGRAM). A IA roda fora da transação; falha dela vira
	 * status ERROR com a mensagem no post (a tela mostra e oferece "Reprocessar").
	 */
	public InstagramPostView generate(String id, AuthenticatedUser user) {
		return generate(id, user, null);
	}

	/**
	 * Rascunho pedido pela sincronização (job INSTAGRAM_IMPORT, spec 001): mesmas regras, em nome do ator de sistema.
	 * {@code altText} = descrição da foto vinda da Meta (vira o texto alternativo; publicar exige um).
	 */
	InstagramPostView generateFromSync(String id, String altText) {
		return generate(id, SyncActor.USER, altText);
	}

	private InstagramPostView generate(String id, AuthenticatedUser user, String altText) {
		InstagramRepository.Current post = current(id);
		if (!CAN_GENERATE.contains(post.status()) || post.newsId() != null) {
			throw new ApiException(HttpStatus.CONFLICT, "Rascunho já gerado",
					"Este post já virou notícia ou foi ignorado.");
		}
		EditorialContext context = repo.editorialContext();
		AiDraft draft;
		try {
			draft = ai.draftFromPost(new SourcePost(post.caption(), post.permalink(), post.postedAt()), context);
		}
		catch (QuotaDeferredException e) {
			// Cota grátis da IA esgotada (spec 004, FR-008): o post espera, sem "Erro". Na sincronização, a fila adia o
			// job; no "Gerar agora", a geração fica agendada para a hora em que a cota volta e a tela recebe 429.
			repo.setWaiting(id, "AI", e.retryAt());
			log.info("Post {} aguardando a IA até {}: {}", id, e.retryAt(), e.reason());
			if (SyncActor.is(user)) {
				throw e;
			}
			jobs.enqueueAt(InstagramImportJob.TYPE, Map.of("postId", id, "generate", true), e.retryAt());
			throw new AiQuotaException(e.retryAt());
		}
		catch (ApiException e) {
			log.warn("IA falhou no post {} ({}): {}", id, ai.name(), e.getMessage());
			repo.markError(id, e.getMessage());
			return repo.view(id).orElseThrow();
		}
		NewsDraft newsDraft = toNewsDraft(draft, post, context, user, image(id, altText));
		String output = json.writeValueAsString(draft);
		tx.executeWithoutResult(status -> {
			UUID newsId = news.createDraft(newsDraft, "INSTAGRAM", user).id();
			if (!repo.markImported(id, newsId, draft.generatedBy(), output)) {
				throw new ApiException(HttpStatus.CONFLICT, "Rascunho já gerado",
						"Outra pessoa gerou o rascunho deste post agora há pouco.");
			}
			// Entidade = a notícia gerada (a linha do tempo dela mostra CREATE + AI_GENERATION).
			audit.record(AuditEvent.of(AuditAction.AI_GENERATION, "news", newsId, draft.title())
				.detail("model", draft.generatedBy())
				.detail("instagramPostId", id)
				.detail("permalink", post.permalink())
				.detail("advertising", draft.advertising() ? true : null)
				.detail("source", SyncActor.is(user) ? "API" : null), AuditLog.Actor.of(user));
		});
		repo.clearWaiting(id, "AI");
		log.info("Post {} virou rascunho ({})", id, draft.generatedBy());
		return repo.view(id).orElseThrow();
	}

	@Transactional
	public InstagramPostView ignore(String id, AuthenticatedUser user) {
		InstagramRepository.Current post = current(id);
		if (post.newsId() != null) {
			throw new ApiException(HttpStatus.CONFLICT, "Post já virou notícia",
					"Edite ou exclua a notícia pelo editor.");
		}
		repo.setStatus(id, "IGNORED", "Ignorado por " + user.name() + ".");
		audit.record(AuditEvent.of(AuditAction.IGNORE, "instagram_post", id, post.permalink())
			.withDiff(AuditDiff.field("status", post.status(), "IGNORED")), AuditLog.Actor.of(user));
		return repo.view(id).orElseThrow();
	}

	/** Volta para a fila: com notícia, como importado; sem, como novo. */
	@Transactional
	public InstagramPostView restore(String id) {
		InstagramRepository.Current post = current(id);
		if (!"IGNORED".equals(post.status())) {
			throw new ApiException(HttpStatus.CONFLICT, "Post não está ignorado", "Só dá para restaurar post ignorado.");
		}
		String status = post.newsId() == null ? "NEW" : "IMPORTED";
		repo.setStatus(id, status, null);
		audit.record(AuditEvent.of(AuditAction.RESTORE, "instagram_post", id, post.permalink())
			.withDiff(AuditDiff.field("status", post.status(), status)));
		return repo.view(id).orElseThrow();
	}

	public InstagramPostView acknowledge(String id) {
		current(id);
		repo.acknowledge(id);
		return repo.view(id).orElseThrow();
	}

	private InstagramRepository.Current current(String id) {
		return repo.current(id).orElseThrow(() -> new NotFoundException("Post não encontrado na fila."));
	}

	/**
	 * Foto principal guardada do post (spec 001, FR-009), com crédito da conta de origem. Sem foto guardada, o
	 * rascunho nasce sem imagem (como na importação manual).
	 */
	private NewsDraft.Image image(String id, String altText) {
		return repo.mainMediaUrl(id).map(url -> {
			String origin = repo.igUserIdOf(id).orElse(null);
			String account = repo.connection()
				.filter(c -> c.igUserId().equals(origin))
				.map(c -> " @" + c.username())
				.orElse("");
			return new NewsDraft.Image(url, altText == null ? "" : altText.strip(), null,
					"Foto: Reprodução/Instagram" + account);
		}).orElse(null);
	}

	/**
	 * Rascunho do editor a partir da IA. Sem editoria válida, usa a primeira do site (o rascunho exige uma; o
	 * editor troca). Urgente e tópicos novos só entram se o perfil puder (mesmas regras do editor).
	 */
	private NewsDraft toNewsDraft(AiDraft d, InstagramRepository.Current post, EditorialContext context,
			AuthenticatedUser user, NewsDraft.Image image) {
		List<Map<String, String>> body = new ArrayList<>();
		d.paragraphs().forEach(p -> body.add(Map.of("type", "paragraph", "html", HtmlUtils.htmlEscape(p))));
		String category = d.categorySlug() != null ? d.categorySlug()
				: context.categories().isEmpty() ? null : context.categories().getFirst().slug();
		boolean canTag = user.permissions().contains("tags.manage");
		boolean canUrgent = user.permissions().contains("news.mark_urgent");
		return new NewsDraft(null, d.title(), d.subtitle(), d.summary(), json.valueToTree(body),
				category, user.authorSlug() == null ? List.of() : List.of(user.authorSlug()), d.neighborhoodSlug(),
				List.of(), canTag ? d.tags() : List.of(), image, d.urgent() && canUrgent, false, null, null, null,
				null, "INSTAGRAM", post.caption(), null, null);
	}

	/** "Gerar agora" com a cota grátis da IA esgotada (spec 004): 429 com a hora em que o rascunho sai sozinho. */
	static class AiQuotaException extends ApiException {

		private final transient java.time.Instant retryAt;

		AiQuotaException(java.time.Instant retryAt) {
			super(HttpStatus.TOO_MANY_REQUESTS, "Limite da IA",
					"A cota gratuita da IA acabou por agora. O rascunho será gerado sozinho quando ela voltar.");
			this.retryAt = retryAt;
		}

		@Override
		public Map<String, Object> properties() {
			return Map.of("retryAt", retryAt.toString());
		}

	}

}
