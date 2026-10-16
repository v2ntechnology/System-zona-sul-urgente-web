package br.com.zonasulurgente.api.news.admin;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.news.admin.AdminNewsRepository.Current;
import br.com.zonasulurgente.api.news.admin.AdminNewsRepository.Fields;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import tools.jackson.databind.json.JsonMapper;

/**
 * CRUD de notícias do painel (BE-009). Regras de ARCHITECTURE §8: quem só tem news.edit.own
 * mexe nas próprias; publicar/agendar/despublicar exige news.publish; urgente, patrocinada e
 * tópico novo têm permissão própria. Cada salvamento grava uma versão completa; o bloqueio
 * otimista impede sobrescrever a edição de outra pessoa. Após o commit sai um
 * {@link NewsChangedEvent} (revalidação do site, BE-011).
 */
@Service
public class AdminNewsService {

	private final AdminNewsRepository repo;
	private final JsonMapper json;
	private final ApplicationEventPublisher events;

	public AdminNewsService(AdminNewsRepository repo, JsonMapper json, ApplicationEventPublisher events) {
		this.repo = repo;
		this.json = json;
		this.events = events;
	}

	@Transactional(readOnly = true)
	public AdminPage<AdminNewsRow> list(String query, String status, String category, String origin, int page,
			int pageSize) {
		return repo.list(new AdminNewsRepository.Filter(query, status, category, origin, page, pageSize));
	}

	@Transactional(readOnly = true)
	public Map<String, Long> counts() {
		return repo.counts();
	}

	@Transactional(readOnly = true)
	public NewsDraft.Out draft(UUID id) {
		return repo.draft(id).orElseThrow(() -> new NotFoundException("Notícia não encontrada."));
	}

	@Transactional(readOnly = true)
	public List<AdminNewsRepository.VersionRow> versions(UUID id, AuthenticatedUser user) {
		Current current = repo.current(id).orElseThrow(() -> new NotFoundException("Notícia não encontrada."));
		if (!can(user, "news.edit.any") && !repo.isOwn(current.id(), user.id(), user.authorSlug())) {
			throw forbidden("Você só vê as versões das suas matérias.");
		}
		return repo.versions(id);
	}

	/** Cria (id nulo) ou atualiza uma notícia a partir do editor. */
	@Transactional
	public SaveResult save(UUID id, NewsDraft draft, String intent, AuthenticatedUser user) {
		OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
		Current current = id == null ? null
				: repo.current(id).orElseThrow(() -> new NotFoundException("Notícia não encontrada."));
		checkPermissions(current, draft, intent, user);

		BodySanitizer.Result body = BodySanitizer.sanitize(draft.body());
		Map<String, String> errors = new LinkedHashMap<>(DraftValidator.validate(draft, intent, body.hasParagraph(), now));

		// Referências por slug.
		UUID categoryId = null;
		if (!DraftValidator.trim(draft.categorySlug()).isEmpty()) {
			categoryId = repo.categoryId(draft.categorySlug()).orElse(null);
			if (categoryId == null) {
				errors.put("categorySlug", "Editoria inexistente ou desativada.");
			}
		}
		List<String> authorSlugs = draft.authorSlugs() == null ? List.of() : draft.authorSlugs();
		Map<String, UUID> authors = repo.authorIds(authorSlugs);
		if (authors.size() < authorSlugs.stream().distinct().count()) {
			errors.put("authorSlugs", "Autor inexistente ou desativado.");
		}
		UUID[] place = null;
		if (!DraftValidator.trim(draft.neighborhoodSlug()).isEmpty()) {
			place = repo.neighborhood(draft.neighborhoodSlug()).orElse(null);
			if (place == null) {
				errors.put("neighborhoodSlug", "Bairro inexistente.");
			}
		}
		List<String> tagSlugs = draft.tagSlugs() == null ? List.of() : draft.tagSlugs();
		Map<String, UUID> tags = repo.tagIds(tagSlugs);
		if (tags.size() < tagSlugs.stream().distinct().count()) {
			errors.put("newTags", "Tópico inexistente.");
		}
		if (categoryId == null && !errors.containsKey("categorySlug")) {
			// Até o rascunho precisa de editoria (é ela que define o endereço da matéria).
			errors.put("categorySlug", "Escolha a editoria.");
		}
		if (!errors.isEmpty()) {
			throw new DraftValidationException(errors);
		}

		String status = nextStatus(current, intent);
		// Primeira publicação: o horário vem do relógio do banco (o filtro público compara com ele).
		OffsetDateTime publishedAt = current == null ? null : current.publishedAt();
		OffsetDateTime scheduledFor = "SCHEDULED".equals(status) ? DraftValidator.scheduledFor(draft.scheduledFor())
				: null;
		// O endereço muda com o título só enquanto a matéria nunca foi ao ar (links não quebram).
		String slug = current != null && current.publishedAt() != null ? current.slug()
				: repo.uniqueSlug(TagKeys.slug(draft.title()), id);
		UUID imageId = draft.image() != null && !DraftValidator.trim(draft.image().url()).isEmpty()
				? repo.imageAsset(draft.image())
				: null;
		NewsDraft.Seo seo = draft.seo() == null ? new NewsDraft.Seo("", "") : draft.seo();

		Fields fields = new Fields(slug, draft.title().strip(), draft.subtitle(),
				DraftValidator.trim(draft.summary()).isEmpty() ? draft.title().strip() : draft.summary().strip(),
				json.writeValueAsString(body.blocks()), body.text(), categoryId, place == null ? null : place[1],
				place == null ? null : place[0], imageId, status, draft.isUrgent(), draft.isSponsored(),
				draft.sponsorName(), seo.title(), seo.description(), Math.max(1, Math.round(body.words() / 200f)),
				publishedAt, scheduledFor, current == null ? "MANUAL" : null);

		UUID newsId;
		int version;
		if (current == null) {
			newsId = repo.insert(fields, user.id());
			version = 1;
		}
		else {
			int expected = draft.version() == null ? current.version() : draft.version();
			if (!repo.update(current.id(), expected, fields, user.id())) {
				throw new ApiException(HttpStatus.CONFLICT, "Notícia alterada por outra pessoa",
						"Alguém salvou esta notícia enquanto você editava. Recarregue para ver a versão atual.");
			}
			newsId = current.id();
			version = expected + 1;
		}

		List<UUID> tagIds = new ArrayList<>(tags.values());
		for (String name : draft.newTags() == null ? List.<String>of() : draft.newTags()) {
			tagIds.add(repo.ensureTag(name));
		}
		repo.replaceAuthors(newsId, authorSlugs.stream().distinct().map(authors::get).toList());
		repo.replaceTags(newsId, tagIds);
		repo.saveVersion(newsId, version, json.writeValueAsString(repo.draft(newsId).orElseThrow()), user.id());
		events.publishEvent(new NewsChangedEvent(newsId, slug, current == null ? null : current.slug(), status,
				current == null ? null : current.status()));
		return new SaveResult(newsId, slug, status, version, now);
	}

	@Transactional
	public SaveResult publish(UUID id, AuthenticatedUser user) {
		return changeState(id, user, "PUBLISHED");
	}

	@Transactional
	public SaveResult unpublish(UUID id, AuthenticatedUser user) {
		return changeState(id, user, "UNPUBLISHED");
	}

	@Transactional
	public SaveResult delete(UUID id, AuthenticatedUser user) {
		return changeState(id, user, "DELETED");
	}

	@Transactional
	public SaveResult restore(UUID id, AuthenticatedUser user) {
		return changeState(id, user, "RESTORED");
	}

	// ---------------------------------------------------------------- internos

	private SaveResult changeState(UUID id, AuthenticatedUser user, String action) {
		Current current = repo.current(id).orElseThrow(() -> new NotFoundException("Notícia não encontrada."));
		String status = current.status();
		switch (action) {
			case "PUBLISHED" -> {
				if (current.deletedAt() != null) {
					throw new ApiException(HttpStatus.CONFLICT, "Notícia na lixeira", "Restaure antes de publicar.");
				}
				repo.changeState(id, "status = 'PUBLISHED', scheduled_for = NULL, published_at = coalesce(published_at, now())",
						Map.of(), user.id());
				status = "PUBLISHED";
			}
			case "UNPUBLISHED" -> {
				if (!"PUBLISHED".equals(current.status())) {
					throw new ApiException(HttpStatus.CONFLICT, "Não está no ar", "Só dá para despublicar matéria publicada.");
				}
				repo.changeState(id, "status = 'UNPUBLISHED'", Map.of(), user.id());
				status = "UNPUBLISHED";
			}
			case "DELETED" -> repo.changeState(id, "deleted_at = now(), deleted_by = :user", Map.of(), user.id());
			case "RESTORED" -> repo.changeState(id, "deleted_at = NULL, deleted_by = NULL", Map.of(), user.id());
			default -> throw new IllegalArgumentException(action);
		}
		int version = current.version() + 1;
		repo.saveVersion(id, version, json.writeValueAsString(repo.draft(id).orElseThrow()), user.id());
		events.publishEvent(new NewsChangedEvent(id, current.slug(), current.slug(),
				"DELETED".equals(action) ? "DELETED" : status, current.status()));
		return new SaveResult(id, current.slug(), status, version, OffsetDateTime.now(ZoneOffset.UTC));
	}

	private void checkPermissions(Current current, NewsDraft draft, String intent, AuthenticatedUser user) {
		if (current != null) {
			if (current.deletedAt() != null) {
				throw new ApiException(HttpStatus.CONFLICT, "Notícia na lixeira", "Restaure antes de editar.");
			}
			if (!can(user, "news.edit.any")
					&& !(can(user, "news.edit.own") && repo.isOwn(current.id(), user.id(), user.authorSlug()))) {
				throw forbidden("Você só pode editar as suas matérias.");
			}
			// Matéria no ar: qualquer mudança vai direto para o leitor — só quem publica altera.
			if ("PUBLISHED".equals(current.status()) && !can(user, "news.publish")) {
				throw forbidden("Esta matéria já está no ar. Peça a um editor para alterar.");
			}
		}
		if (("publish".equals(intent) || "schedule".equals(intent)) && !can(user, "news.publish")) {
			throw forbidden("Seu perfil não pode publicar. Envie para revisão.");
		}
		boolean wasUrgent = current != null && current.isUrgent();
		if (draft.isUrgent() && !wasUrgent && !can(user, "news.mark_urgent")) {
			throw forbidden("Seu perfil não pode marcar urgente.");
		}
		boolean wasSponsored = current != null && current.isSponsored();
		if (draft.isSponsored() != wasSponsored && !can(user, "news.mark_sponsored")) {
			throw forbidden("Seu perfil não pode marcar matéria patrocinada.");
		}
		// COMERCIAL só produz publieditorial (ARCHITECTURE §8, nota 1).
		if ("COMERCIAL".equals(user.role()) && !draft.isSponsored()) {
			throw forbidden("O perfil Comercial cria só matérias patrocinadas.");
		}
		if (draft.newTags() != null && !draft.newTags().isEmpty() && !can(user, "tags.manage")) {
			throw forbidden("Seu perfil não pode criar tópicos. Escolha um existente.");
		}
	}

	/** Rascunho numa matéria já publicada não a tira do ar: salva as mudanças nela. */
	private static String nextStatus(Current current, String intent) {
		return switch (intent) {
			case "publish" -> "PUBLISHED";
			case "schedule" -> "SCHEDULED";
			case "review" -> "IN_REVIEW";
			default -> current != null && "PUBLISHED".equals(current.status()) ? "PUBLISHED" : "DRAFT";
		};
	}

	private static boolean can(AuthenticatedUser user, String permission) {
		return user.permissions().contains(permission);
	}

	private static ApiException forbidden(String detail) {
		return new ApiException(HttpStatus.FORBIDDEN, "Acesso negado", detail);
	}

}
