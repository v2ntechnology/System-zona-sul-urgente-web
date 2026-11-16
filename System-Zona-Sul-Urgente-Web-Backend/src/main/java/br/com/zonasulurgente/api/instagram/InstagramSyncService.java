package br.com.zonasulurgente.api.instagram;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import br.com.zonasulurgente.api.audit.AuditAction;
import br.com.zonasulurgente.api.audit.AuditDiff;
import br.com.zonasulurgente.api.audit.AuditEvent;
import br.com.zonasulurgente.api.audit.AuditLog;
import br.com.zonasulurgente.api.instagram.InstagramConnectionService.Active;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.AccessRevokedException;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.GraphException;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.Media;
import br.com.zonasulurgente.api.jobs.JobQueue;

/**
 * Varredura da conta ligada (BE-013, spec 001 — R4, R6, R7, R9). Lê os posts do mais novo para o mais antigo,
 * coloca os novos na fila (um job {@code INSTAGRAM_IMPORT} por post baixa a mídia e pede o rascunho), liga posts
 * colados à mão pelo link e confere, nos últimos {@code reconcile-window}, legenda alterada e post apagado — sem nunca
 * mexer na notícia. Acesso revogado para a sincronização e avisa; falha passageira só conta para o aviso.
 */
@Service
public class InstagramSyncService {

	/** O que uma varredura fez. */
	public record Result(int added, int linked, int changed, int removed) {

		static final Result NOTHING = new Result(0, 0, 0, 0);

	}

	/** Teto de páginas por varredura (25 posts cada): protege o limite de chamadas da Meta. */
	static final int MAX_PAGES = 20;

	private static final Logger log = LoggerFactory.getLogger(InstagramSyncService.class);

	private final InstagramConnectionService connections;
	private final InstagramGraphClient graph;
	private final InstagramRepository repo;
	private final JobQueue queue;
	private final InstagramProperties props;
	private final AuditLog audit;
	private final TransactionTemplate tx;
	private final ReentrantLock running = new ReentrantLock();

	public InstagramSyncService(InstagramConnectionService connections, InstagramGraphClient graph,
			InstagramRepository repo, JobQueue queue, InstagramProperties props, AuditLog audit,
			TransactionTemplate tx) {
		this.connections = connections;
		this.graph = graph;
		this.repo = repo;
		this.queue = queue;
		this.props = props;
		this.audit = audit;
		this.tx = tx;
	}

	/** Uma varredura. Vazio quando não há conta ativa ou outra varredura já está rodando. */
	public Optional<Result> sync() {
		if (!running.tryLock()) {
			return Optional.empty();
		}
		try {
			Optional<Active> active = connections.active();
			if (active.isEmpty()) {
				return Optional.empty();
			}
			return Optional.of(run(active.get()));
		}
		finally {
			running.unlock();
		}
	}

	private Result run(Active account) {
		OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
		OffsetDateTime lower = lowerBound(account, now);
		try {
			List<Media> fetched = new ArrayList<>();
			boolean complete = fetch(account, lower, fetched);
			Result applied = tx.execute(status -> apply(account, fetched, complete, lower));
			int removed = confirmRemovals(account, fetched, complete, lower);
			repo.syncSucceeded();
			Result result = new Result(applied.added(), applied.linked(), applied.changed(), removed);
			if (!result.equals(Result.NOTHING)) {
				log.info("Instagram @{}: {} novo(s), {} ligado(s) a post manual, {} alterado(s), {} removido(s)",
						account.username(), result.added(), result.linked(), result.changed(), result.removed());
			}
			return result;
		}
		catch (AccessRevokedException e) {
			tx.executeWithoutResult(status -> {
				if (repo.markRevoked(e.getMessage())) {
					audit.recordSystem(AuditEvent.of(AuditAction.INSTAGRAM_ACCESS_LOST, "instagram_connection",
							account.igUserId(), "@" + account.username())
						.detail("code", e.code()));
				}
			});
			log.warn("Instagram @{}: acesso perdido ({}); sincronização parada até religar a conta",
					account.username(), e.getMessage());
			return Result.NOTHING;
		}
		catch (GraphException e) {
			int failures = repo.syncFailed(e.getMessage());
			log.warn("Instagram @{}: varredura falhou ({} seguida(s)): {}", account.username(), failures,
					e.getMessage());
			return Result.NOTHING;
		}
	}

	/**
	 * Até onde ler: o mais recente entre o início do backfill e a janela de conferência — estendido até a última
	 * sincronização boa quando a conta ficou muito tempo sem sincronizar (para não perder post novo).
	 */
	private OffsetDateTime lowerBound(Active account, OffsetDateTime now) {
		OffsetDateTime window = now.minus(props.reconcileWindow());
		OffsetDateTime lower = account.backfillSince().isAfter(window) ? account.backfillSince() : window;
		if (account.lastSuccessAt() != null && account.lastSuccessAt().isBefore(lower)) {
			OffsetDateTime resume = account.lastSuccessAt().minusHours(1);
			lower = resume.isAfter(account.backfillSince()) ? resume : account.backfillSince();
		}
		return lower;
	}

	/** Lê as páginas até passar de {@code lower}. Verdadeiro se viu tudo até lá (ausência = post apagado). */
	private boolean fetch(Active account, OffsetDateTime lower, List<Media> into) {
		String after = null;
		for (int page = 0; page < MAX_PAGES; page++) {
			InstagramGraphClient.Page result = graph.media(account.igUserId(), account.token(), after);
			for (Media media : result.items()) {
				if (media.timestamp() == null) {
					continue;
				}
				if (media.timestamp().isBefore(lower)) {
					return true;
				}
				into.add(media);
			}
			after = result.after();
			if (after == null) {
				return true;
			}
		}
		log.warn("Instagram @{}: varredura parou em {} páginas", account.username(), MAX_PAGES);
		return false;
	}

	private Result apply(Active account, List<Media> fetched, boolean complete, OffsetDateTime lower) {
		int added = 0;
		int linked = 0;
		List<Media> oldestFirst = fetched.stream().sorted(Comparator.comparing(Media::timestamp)).toList();
		for (Media media : oldestFirst) {
			if (media.timestamp().isBefore(account.backfillSince())) {
				continue;
			}
			String permalink = InstagramQueueService.canonicalPermalink(media.permalink()).orElse(media.permalink());
			if (permalink == null) {
				continue;
			}
			String caption = media.caption() == null ? "" : media.caption().strip();
			int count = Math.max(1, media.children().size());
			Optional<String> existing = repo.findByMediaIdOrPermalink(media.id(), permalink);
			if (existing.isEmpty()) {
				repo.insertFromApi(media.id(), caption, permalink, media.mediaType(), media.mediaProductType(), count,
						media.timestamp(), account.igUserId());
				queue.enqueue(InstagramImportJob.TYPE, Map.of("postId", media.id()));
				audit.record(AuditEvent.of(AuditAction.INSTAGRAM_IMPORT, "instagram_post", media.id(), permalink)
					.withDiff(AuditDiff.created(Map.of("permalink", permalink, "caption", caption)))
					.detail("source", "API"), AuditLog.Actor.of(SyncActor.USER));
				added++;
			}
			else if (!existing.get().equals(media.id())) {
				// Colado à mão antes: ganha o ID da Meta e a mídia, mas continua MANUAL (research.md R11).
				var target = repo.importTarget(existing.get()).orElseThrow();
				if (target.igMediaId() == null) {
					repo.linkManual(existing.get(), media.id(), account.igUserId(), media.mediaType(),
							media.mediaProductType(), count);
					if (target.storedMedia() == 0) {
						queue.enqueue(InstagramImportJob.TYPE, Map.of("postId", existing.get()));
					}
					linked++;
				}
			}
		}
		int changed = reconcileCaptions(account, fetched, lower);
		return new Result(added, linked, changed, 0);
	}

	/** Legenda diferente da última vista → "Alterado no Instagram"; a original nunca muda (FR-012). */
	private int reconcileCaptions(Active account, List<Media> fetched, OffsetDateTime lower) {
		Map<String, Media> byId = new LinkedHashMap<>();
		fetched.forEach(m -> byId.put(m.id(), m));
		int changed = 0;
		for (InstagramRepository.Tracked post : repo.tracked(account.igUserId(), lower)) {
			Media media = byId.get(post.igMediaId());
			if (media == null) {
				continue;
			}
			String now = media.caption() == null ? "" : media.caption().strip();
			String seen = (post.currentCaption() != null ? post.currentCaption() : post.caption()).strip();
			if (!now.equals(seen)) {
				repo.markChanged(post.id(), now);
				changed++;
			}
		}
		return changed;
	}

	/**
	 * Post importado que não veio na lista: confirma um a um antes de marcar "Removido do Instagram" (FR-013). Só
	 * quando a leitura foi completa até {@code lower} — uma leitura cortada não prova que o post sumiu.
	 */
	private int confirmRemovals(Active account, List<Media> fetched, boolean complete, OffsetDateTime lower) {
		if (!complete) {
			return 0;
		}
		Set<String> seen = new HashSet<>();
		fetched.forEach(m -> seen.add(m.id()));
		int removed = 0;
		for (InstagramRepository.Tracked post : repo.tracked(account.igUserId(), lower)) {
			if (seen.contains(post.igMediaId())) {
				continue;
			}
			if (graph.mediaById(post.igMediaId(), account.token()).isEmpty()) {
				repo.markRemoved(post.id());
				removed++;
			}
		}
		return removed;
	}

}
