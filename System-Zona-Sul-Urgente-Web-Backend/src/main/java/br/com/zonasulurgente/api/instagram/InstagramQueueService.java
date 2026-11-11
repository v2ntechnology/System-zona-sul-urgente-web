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
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.HtmlUtils;

import br.com.zonasulurgente.api.ai.AiDraft;
import br.com.zonasulurgente.api.ai.EditorialAiProvider;
import br.com.zonasulurgente.api.ai.EditorialContext;
import br.com.zonasulurgente.api.ai.SourcePost;
import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.news.admin.AdminNewsService;
import br.com.zonasulurgente.api.news.admin.NewsDraft;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.InvalidFieldsException;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Fila do Instagram (FE-155): importação manual (enquanto não há app da Meta), geração do rascunho pela IA
 * (BE-014) e as ações de revisão. 1 post → no máximo 1 notícia, sempre em rascunho (ARCHITECTURE §6).
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

	public InstagramQueueService(InstagramRepository repo, EditorialAiProvider ai, AdminNewsService news,
			TransactionTemplate tx, JsonMapper json) {
		this.repo = repo;
		this.ai = ai;
		this.news = news;
		this.tx = tx;
		this.json = json;
	}

	public List<InstagramPostView> list(String status) {
		return repo.list(status);
	}

	public Map<String, Long> counts() {
		return repo.counts();
	}

	/** Post colado no painel (link + legenda). O código do link vira o ID (deduplicação). */
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
		return repo.view(code).orElseThrow();
	}

	/**
	 * Pede o rascunho à IA e cria a notícia (origem INSTAGRAM). A IA roda fora da transação; falha dela vira
	 * status ERROR com a mensagem no post (a tela mostra e oferece "Reprocessar").
	 */
	public InstagramPostView generate(String id, AuthenticatedUser user) {
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
		catch (ApiException e) {
			log.warn("IA falhou no post {} ({}): {}", id, ai.name(), e.getMessage());
			repo.markError(id, e.getMessage());
			return repo.view(id).orElseThrow();
		}
		NewsDraft newsDraft = toNewsDraft(draft, post, context, user);
		String output = json.writeValueAsString(draft);
		tx.executeWithoutResult(status -> {
			UUID newsId = news.createDraft(newsDraft, "INSTAGRAM", user).id();
			if (!repo.markImported(id, newsId, draft.generatedBy(), output)) {
				throw new ApiException(HttpStatus.CONFLICT, "Rascunho já gerado",
						"Outra pessoa gerou o rascunho deste post agora há pouco.");
			}
		});
		log.info("Post {} virou rascunho ({})", id, draft.generatedBy());
		return repo.view(id).orElseThrow();
	}

	public InstagramPostView ignore(String id, AuthenticatedUser user) {
		InstagramRepository.Current post = current(id);
		if (post.newsId() != null) {
			throw new ApiException(HttpStatus.CONFLICT, "Post já virou notícia",
					"Edite ou exclua a notícia pelo editor.");
		}
		repo.setStatus(id, "IGNORED", "Ignorado por " + user.name() + ".");
		return repo.view(id).orElseThrow();
	}

	/** Volta para a fila: com notícia, como importado; sem, como novo. */
	public InstagramPostView restore(String id) {
		InstagramRepository.Current post = current(id);
		if (!"IGNORED".equals(post.status())) {
			throw new ApiException(HttpStatus.CONFLICT, "Post não está ignorado", "Só dá para restaurar post ignorado.");
		}
		repo.setStatus(id, post.newsId() == null ? "NEW" : "IMPORTED", null);
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
	 * Rascunho do editor a partir da IA. Sem editoria válida, usa a primeira do site (o rascunho exige uma; o
	 * editor troca). Urgente e tópicos novos só entram se o perfil puder (mesmas regras do editor).
	 */
	private NewsDraft toNewsDraft(AiDraft d, InstagramRepository.Current post, EditorialContext context,
			AuthenticatedUser user) {
		List<Map<String, String>> body = new ArrayList<>();
		d.paragraphs().forEach(p -> body.add(Map.of("type", "paragraph", "html", HtmlUtils.htmlEscape(p))));
		String category = d.categorySlug() != null ? d.categorySlug()
				: context.categories().isEmpty() ? null : context.categories().getFirst().slug();
		boolean canTag = user.permissions().contains("tags.manage");
		boolean canUrgent = user.permissions().contains("news.mark_urgent");
		return new NewsDraft(null, d.title(), d.subtitle(), d.summary(), json.valueToTree(body),
				category, user.authorSlug() == null ? List.of() : List.of(user.authorSlug()), d.neighborhoodSlug(),
				List.of(), canTag ? d.tags() : List.of(), null, d.urgent() && canUrgent, false, null, null, null,
				null, "INSTAGRAM", post.caption(), null, null);
	}

}
