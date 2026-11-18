package br.com.zonasulurgente.api.instagram;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Post na fila de importação — espelho de {@code InstagramPost} (src/types/admin.ts). Opcionais ausentes,
 * nunca null. {@code waiting}: "SPACE" (foto aguardando espaço) ou "AI" (rascunho aguardando a cota da IA, até
 * {@code waitingUntil}) — spec 004.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record InstagramPostView(String id, String caption, String currentCaption, String permalink,
		String mediaType, int mediaCount, String thumbnailUrl, OffsetDateTime postedAt, String status,
		NewsRef news, String error, Integer attempts, String ignoredReason, OffsetDateTime sourceChangedAt,
		String source, boolean needsPhoto, List<String> mediaUrls, String waiting, OffsetDateTime waitingUntil) {

	/** Notícia gerada a partir do post; parágrafos em texto puro (comparação com a legenda). */
	public record NewsRef(UUID id, String title, String status, String summary, List<String> paragraphs) {
	}

}
