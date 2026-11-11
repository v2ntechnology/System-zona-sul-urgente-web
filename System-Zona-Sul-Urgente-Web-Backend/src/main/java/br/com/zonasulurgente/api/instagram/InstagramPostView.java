package br.com.zonasulurgente.api.instagram;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Post na fila de importação — espelho de {@code InstagramPost} (src/types/admin.ts). Opcionais ausentes,
 * nunca null.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record InstagramPostView(String id, String caption, String currentCaption, String permalink,
		String mediaType, int mediaCount, String thumbnailUrl, OffsetDateTime postedAt, String status,
		NewsRef news, String error, Integer attempts, String ignoredReason, OffsetDateTime sourceChangedAt) {

	/** Notícia gerada a partir do post; parágrafos em texto puro (comparação com a legenda). */
	public record NewsRef(UUID id, String title, String status, String summary, List<String> paragraphs) {
	}

}
