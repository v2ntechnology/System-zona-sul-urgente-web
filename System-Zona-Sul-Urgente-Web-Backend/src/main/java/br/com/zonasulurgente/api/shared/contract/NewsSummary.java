package br.com.zonasulurgente.api.shared.contract;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Versão resumida da notícia (cards, listas, feeds). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record NewsSummary(UUID id, String slug, String title, String subtitle, String summary,
		Category category, NewsLocation location, MediaAsset image, boolean hasVideo, boolean isUrgent,
		boolean isSponsored, OffsetDateTime publishedAt, OffsetDateTime updatedAt) {
}
