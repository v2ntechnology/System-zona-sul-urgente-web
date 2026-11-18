package br.com.zonasulurgente.api.instagram;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import br.com.zonasulurgente.api.instagram.InstagramConnectionService.Active;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.AccessRevokedException;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.Child;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.GraphRejectedException;
import br.com.zonasulurgente.api.instagram.InstagramGraphClient.Media;
import br.com.zonasulurgente.api.jobs.JobDeferredException;
import br.com.zonasulurgente.api.jobs.JobHandler;
import br.com.zonasulurgente.api.jobs.JobQueue;
import br.com.zonasulurgente.api.media.MediaService;
import br.com.zonasulurgente.api.news.admin.AdminNewsService;
import br.com.zonasulurgente.api.news.admin.NewsDraft;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.usage.QuotaBlockedException;
import tools.jackson.databind.JsonNode;

/**
 * Job INSTAGRAM_IMPORT (spec 001, FR-008 a FR-011): guarda as imagens do post (foto, carrossel, capa do vídeo — nunca
 * o arquivo de vídeo) e, se o post veio da sincronização, pede o rascunho à IA. Idempotente: imagem já guardada na
 * mesma posição não é baixada de novo, e o rascunho só sai uma vez. Post colado à mão só ganha a mídia (R11). Falha
 * passageira da Meta = nova tentativa pela fila; acesso perdido = desiste sem repetir (o painel já avisa).
 */
@Component
class InstagramImportJob implements JobHandler {

	static final String TYPE = "INSTAGRAM_IMPORT";

	private static final Set<String> CAN_GENERATE = Set.of("NEW", "ERROR");

	private static final Logger log = LoggerFactory.getLogger(InstagramImportJob.class);

	/** Uma imagem a guardar: posição no carrossel, endereço na Meta e tipo. */
	record Source(int position, String url, String kind) {
	}

	private final InstagramRepository repo;
	private final InstagramConnectionService connections;
	private final InstagramGraphClient graph;
	private final MediaService media;
	private final InstagramQueueService queue;
	private final JobQueue jobs;
	private final AdminNewsService news;

	InstagramImportJob(InstagramRepository repo, InstagramConnectionService connections, InstagramGraphClient graph,
			MediaService media, InstagramQueueService queue, JobQueue jobs, AdminNewsService news) {
		this.jobs = jobs;
		this.news = news;
		this.repo = repo;
		this.connections = connections;
		this.graph = graph;
		this.media = media;
		this.queue = queue;
	}

	@Override
	public String type() {
		return TYPE;
	}

	@Override
	public void handle(JsonNode payload) {
		String id = payload.path("postId").asString();
		// photoRetry: a foto ficou esperando espaço (spec 004); generate: "Gerar agora" adiado pela cota da IA.
		boolean photoRetry = payload.path("photoRetry").asBoolean(false);
		boolean forceGenerate = payload.path("generate").asBoolean(false);
		Optional<InstagramRepository.ImportTarget> found = repo.importTarget(id);
		if (found.isEmpty()) {
			return;
		}
		InstagramRepository.ImportTarget target = found.get();
		String altText = null;
		if (target.igMediaId() != null && target.storedMedia() == 0) {
			Optional<Active> account = connections.active();
			if (account.isEmpty()) {
				log.info("Post {} sem mídia: conta do Instagram desligada ou sem acesso", id);
				return;
			}
			Optional<Media> post;
			try {
				post = graph.mediaById(target.igMediaId(), account.get().token());
			}
			catch (AccessRevokedException e) {
				log.warn("Post {}: acesso ao Instagram perdido; mídia não baixada", id);
				return;
			}
			if (post.isEmpty()) {
				log.info("Post {} não existe mais no Instagram; mídia não baixada", id);
				repo.refreshMainMedia(id);
				return;
			}
			boolean complete = store(id, sources(post.get()), photoRetry);
			altText = altText(post.get());
			if (complete) {
				repo.clearWaiting(id, "SPACE");
				if (photoRetry && target.newsId() != null) {
					attachToDraft(id, target.newsId(), altText);
				}
			}
		}
		else if (photoRetry) {
			repo.clearWaiting(id, "SPACE");
		}
		boolean canGenerate = CAN_GENERATE.contains(target.status()) && target.newsId() == null;
		if (canGenerate && ("API".equals(target.source()) || forceGenerate)) {
			queue.generateFromSync(id, altText);
		}
	}

	/** Foto chegou depois do rascunho: vira a foto principal dele, se ainda não tiver uma (FR-007). */
	private void attachToDraft(String id, java.util.UUID newsId, String altText) {
		repo.mainMediaUrl(id).ifPresent(url -> {
			String account = repo.connection().map(c -> " @" + c.username()).orElse("");
			if (news.attachImageIfMissing(newsId, new NewsDraft.Image(url, altText == null ? "" : altText.strip(), null,
					"Foto: Reprodução/Instagram" + account))) {
				log.info("Post {}: foto chegou e virou a foto principal do rascunho", id);
			}
		});
	}

	/** Foto → a imagem; vídeo/reel → a capa; carrossel → cada item na ordem (vídeo pela capa). */
	static List<Source> sources(Media post) {
		List<Source> out = new ArrayList<>();
		if ("CAROUSEL_ALBUM".equals(post.mediaType())) {
			for (int i = 0; i < post.children().size(); i++) {
				Child child = post.children().get(i);
				boolean video = "VIDEO".equals(child.mediaType());
				String url = video ? child.thumbnailUrl() : child.mediaUrl();
				if (url != null) {
					out.add(new Source(i, url, video ? "VIDEO_COVER" : "IMAGE"));
				}
			}
		}
		else if ("VIDEO".equals(post.mediaType())) {
			if (post.thumbnailUrl() != null) {
				out.add(new Source(0, post.thumbnailUrl(), "VIDEO_COVER"));
			}
		}
		else if (post.mediaUrl() != null) {
			out.add(new Source(0, post.mediaUrl(), "IMAGE"));
		}
		return out;
	}

	/**
	 * Guarda as imagens que faltam. Devolve falso se parou na trava do espaço das fotos (spec 004): o post fica
	 * "Aguardando espaço" e a foto é buscada de novo quando a trava desligar — na primeira vez, um job novo e adiado; numa
	 * nova tentativa, o próprio job é adiado.
	 */
	private boolean store(String id, List<Source> sources, boolean photoRetry) {
		Set<Integer> stored = repo.mediaPositions(id);
		for (Source source : sources) {
			if (stored.contains(source.position())) {
				continue;
			}
			try {
				byte[] bytes = graph.download(source.url());
				var uploaded = media.upload(bytes, SyncActor.USER);
				repo.addMedia(id, source.position(), uploaded.id(), source.kind());
			}
			catch (QuotaBlockedException e) {
				// Antes do catch genérico (análise C1): sem isso a recusa da trava viraria "imagem indisponível" e a
				// foto se perderia sem aviso.
				repo.refreshMainMedia(id);
				repo.setWaiting(id, "SPACE", null);
				log.info("Post {}: espaço grátis de fotos travado; foto aguardando ({})", id, e.getMessage());
				if (photoRetry) {
					throw new JobDeferredException(e.retryAt(), "espaço de fotos travado");
				}
				jobs.enqueueAt(TYPE, Map.of("postId", id, "photoRetry", true), e.retryAt());
				return false;
			}
			catch (GraphRejectedException | ApiException e) {
				// Imagem indisponível ou inválida: segue com as outras (sem nenhuma, o post pede foto à mão).
				log.warn("Post {}: imagem {} não guardada: {}", id, source.position(), e.getMessage());
			}
		}
		repo.refreshMainMedia(id);
		return true;
	}

	private static String altText(Media post) {
		if (post.altText() != null) {
			return post.altText();
		}
		return post.children().stream().map(Child::altText).filter(a -> a != null).findFirst().orElse(null);
	}

}
