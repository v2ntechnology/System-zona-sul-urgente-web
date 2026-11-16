package br.com.zonasulurgente.api.news.admin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.audit.AuditAction;
import br.com.zonasulurgente.api.audit.AuditDiff;
import br.com.zonasulurgente.api.audit.AuditEvent;
import br.com.zonasulurgente.api.audit.AuditLog;
import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.news.admin.AdminNewsRepository.FeaturedRow;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.InvalidFieldsException;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import br.com.zonasulurgente.api.site.CacheInvalidateJob;

/**
 * Destaques da home (spec 003): a ordem de {@code news.featured_rank} (1 = manchete, 2–3 ao lado, 4–7 faixa, 8–10
 * reserva). Todas as regras de deslocamento ficam aqui — salvar, atalhos e a saída automática ao despublicar — e o
 * repositório só grava a ordem inteira. Regras: só publicada no destaque; patrocinada nunca na manchete; sem manchete
 * escolhida, a home usa a publicada mais recente não patrocinada (manchete automática).
 */
@Service
public class HomeFeaturedService {

	public static final int POSITIONS = 10;

	public enum Shortcut {
		MAIN, HIGHLIGHT, NONE
	}

	/** Notícia num card da tela de destaques. */
	public record NewsCard(UUID id, String slug, String title, String imageUrl, String category,
			OffsetDateTime publishedAt, boolean isSponsored, boolean isUrgent) {
	}

	public record Slot(int position, NewsCard news) {
	}

	/** Contrato em specs/003-destaques-home/contracts/admin-home-featured.md. */
	public record View(List<Slot> slots, NewsCard automaticMain, String signature) {
	}

	/** Outra pessoa salvou depois que a tela abriu: a resposta 409 leva a ordem atual. */
	public static class ConflictException extends ApiException {

		private final transient View current;

		ConflictException(View current) {
			super(HttpStatus.CONFLICT, "Os destaques mudaram",
					"Outra pessoa alterou os destaques depois que você abriu a tela. Confira a ordem atual e salve de novo.");
			this.current = current;
		}

		public View current() {
			return current;
		}

	}

	private final AdminNewsRepository repo;
	private final CacheInvalidateJob cache;
	private final AuditLog audit;

	HomeFeaturedService(AdminNewsRepository repo, CacheInvalidateJob cache, AuditLog audit) {
		this.repo = repo;
		this.cache = cache;
		this.audit = audit;
	}

	public View view() {
		List<FeaturedRow> rows = repo.featured();
		List<UUID> order = order(rows);
		List<Slot> slots = new ArrayList<>();
		Map<Integer, FeaturedRow> byRank = new LinkedHashMap<>();
		rows.forEach(r -> byRank.put(r.rank(), r));
		for (int position = 1; position <= POSITIONS; position++) {
			FeaturedRow row = byRank.get(position);
			slots.add(new Slot(position, row == null ? null : card(row)));
		}
		NewsCard automatic = byRank.containsKey(1) ? null : repo.automaticMain().map(HomeFeaturedService::card).orElse(null);
		return new View(slots, automatic, signature(order));
	}

	/**
	 * Grava a ordem inteira ({@code ids.get(0)} = manchete; nulo = vazia/automática). {@code signature} = a da tela que
	 * carregou a ordem; diferente da atual → 409 com a ordem atual (FR-006).
	 */
	@Transactional
	public View save(List<UUID> ids, String signature, AuthenticatedUser user) {
		List<UUID> wanted = ids == null ? List.of() : new ArrayList<>(ids);
		Map<String, String> errors = new LinkedHashMap<>();
		if (wanted.size() > POSITIONS) {
			errors.put("ids", "No máximo " + POSITIONS + " posições.");
		}
		Set<UUID> seen = new HashSet<>();
		if (wanted.stream().filter(id -> id != null).anyMatch(id -> !seen.add(id))) {
			errors.put("ids", "A mesma notícia aparece em mais de uma posição.");
		}
		if (!errors.isEmpty()) {
			throw new InvalidFieldsException(errors);
		}
		repo.lockFeatured();
		List<FeaturedRow> before = repo.featured();
		if (signature == null || !signature.equals(signature(order(before)))) {
			throw new ConflictException(view());
		}
		validate(wanted);
		apply(before, wanted, null, user);
		return view();
	}

	/** Atalhos da listagem e do editor (FR-007): age sobre a ordem do momento, sem assinatura. */
	@Transactional
	public View feature(UUID newsId, Shortcut as, AuthenticatedUser user) {
		repo.lockFeatured();
		FeaturedRow news = repo.featuredCandidates(List.of(newsId)).get(newsId);
		if (news == null) {
			throw new NotFoundException("Notícia não encontrada.");
		}
		if (as != Shortcut.NONE && !news.live()) {
			throw unprocessable("Só notícia publicada pode ir para o destaque.");
		}
		if (as == Shortcut.MAIN && news.isSponsored()) {
			throw unprocessable("Notícia patrocinada não pode ser a manchete; coloque nos destaques.");
		}
		List<FeaturedRow> before = repo.featured();
		List<UUID> slots = without(slots(before), newsId, sponsoredIds(before));
		switch (as) {
			case MAIN -> {
				if (slots.get(0) == null) {
					slots.set(0, newsId);
				}
				else {
					slots.add(0, newsId);
				}
			}
			case HIGHLIGHT -> slots.add(1, newsId);
			case NONE -> {
			}
		}
		apply(before, trim(slots), as, user);
		return view();
	}

	/**
	 * Saída automática (FR-008): a notícia saiu do ar (despublicada, lixeira) — tira do destaque e sobe as de baixo,
	 * sem promover patrocinada a manchete. Chamado na transação da mudança; a revalidação e a auditoria são as da
	 * própria mudança. Devolve a posição que ela ocupava.
	 */
	Optional<Integer> leave(UUID newsId) {
		repo.lockFeatured();
		List<FeaturedRow> before = repo.featured();
		Optional<Integer> rank = before.stream().filter(r -> r.id().equals(newsId)).map(FeaturedRow::rank).findFirst();
		if (rank.isPresent()) {
			repo.replaceFeatured(without(slots(before), newsId, sponsoredIds(before)));
		}
		return rank;
	}

	// ---------------------------------------------------------------- regras

	/** Só publicadas; patrocinada nunca na posição 1. */
	private void validate(List<UUID> wanted) {
		Map<UUID, FeaturedRow> found = repo.featuredCandidates(wanted.stream().filter(id -> id != null).toList());
		for (int i = 0; i < wanted.size(); i++) {
			UUID id = wanted.get(i);
			if (id == null) {
				continue;
			}
			FeaturedRow row = found.get(id);
			if (row == null) {
				throw unprocessable("Uma das notícias escolhidas não existe mais.");
			}
			if (!row.live()) {
				throw unprocessable("“" + row.title() + "” não está publicada: só notícia publicada vai para o destaque.");
			}
			if (i == 0 && row.isSponsored()) {
				throw unprocessable("“" + row.title() + "” é patrocinada e não pode ser a manchete.");
			}
		}
	}

	/** Grava, manda a home atualizar e audita (antes e depois). Sem mudança real, não faz nada. */
	private void apply(List<FeaturedRow> before, List<UUID> after, Shortcut shortcut, AuthenticatedUser user) {
		List<UUID> previous = slots(before);
		if (normalize(previous).equals(normalize(after))) {
			return;
		}
		repo.replaceFeatured(after);
		cache.enqueue(List.of("home"));
		Map<UUID, String> titles = new LinkedHashMap<>();
		before.forEach(r -> titles.put(r.id(), r.title()));
		repo.featuredCandidates(after.stream().filter(id -> id != null).toList())
			.forEach((id, row) -> titles.put(id, row.title()));
		audit.record(AuditEvent.of(AuditAction.HOME_FEATURE, "home", "home", "Destaques da home")
			.withDiff(AuditDiff.between(Map.of("ordem", describe(previous, titles)),
					Map.of("ordem", describe(after, titles))))
			.detail("shortcut", shortcut == null ? null : shortcut.name()), AuditLog.Actor.of(user));
	}

	/** As 10 posições (nulo = vazia). */
	private static List<UUID> slots(List<FeaturedRow> rows) {
		List<UUID> slots = new ArrayList<>();
		for (int i = 0; i < POSITIONS; i++) {
			slots.add(null);
		}
		rows.forEach(r -> slots.set(r.rank() - 1, r.id()));
		return slots;
	}

	/**
	 * Tira a notícia e sobe as de baixo. Se a manchete saiu e quem subiria para a 1 é patrocinada, a 1 fica vazia
	 * (automática) e as demais ficam onde estão (FR-008, FR-010).
	 */
	private static List<UUID> without(List<UUID> slots, UUID id, Set<UUID> sponsored) {
		List<UUID> out = new ArrayList<>(slots);
		int index = out.indexOf(id);
		if (index < 0) {
			return out;
		}
		if (index == 0 && out.size() > 1 && sponsored.contains(out.get(1))) {
			out.set(0, null);
			return out;
		}
		out.remove(index);
		out.add(null);
		return out;
	}

	private static List<UUID> trim(List<UUID> slots) {
		List<UUID> out = new ArrayList<>(slots);
		while (out.size() > POSITIONS) {
			out.remove(out.size() - 1);
		}
		while (out.size() < POSITIONS) {
			out.add(null);
		}
		return out;
	}

	/** Compara ignorando posições vazias no fim. */
	private static List<UUID> normalize(List<UUID> slots) {
		List<UUID> out = new ArrayList<>(slots);
		while (!out.isEmpty() && out.get(out.size() - 1) == null) {
			out.remove(out.size() - 1);
		}
		return out;
	}

	private static Set<UUID> sponsoredIds(List<FeaturedRow> rows) {
		Set<UUID> out = new HashSet<>();
		rows.stream().filter(FeaturedRow::isSponsored).forEach(r -> out.add(r.id()));
		return out;
	}

	private static List<UUID> order(List<FeaturedRow> rows) {
		return slots(rows);
	}

	/** Assinatura da ordem: SHA-256 (16 primeiros hex) de "posição:id" — data-model.md. */
	static String signature(List<UUID> slots) {
		StringBuilder text = new StringBuilder();
		for (int i = 0; i < slots.size(); i++) {
			if (slots.get(i) != null) {
				text.append(i + 1).append(':').append(slots.get(i)).append(';');
			}
		}
		try {
			byte[] hash = MessageDigest.getInstance("SHA-256").digest(text.toString().getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(hash).substring(0, 16);
		}
		catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}

	private static List<String> describe(List<UUID> slots, Map<UUID, String> titles) {
		List<String> out = new ArrayList<>();
		for (int i = 0; i < slots.size(); i++) {
			if (slots.get(i) != null) {
				out.add((i + 1) + ". " + titles.getOrDefault(slots.get(i), slots.get(i).toString()));
			}
		}
		return out;
	}

	private static NewsCard card(FeaturedRow row) {
		return new NewsCard(row.id(), row.slug(), row.title(), row.imageUrl(), row.category(), row.publishedAt(),
				row.isSponsored(), row.isUrgent());
	}

	private static ApiException unprocessable(String detail) {
		return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "Não dá para destacar", detail);
	}

}
