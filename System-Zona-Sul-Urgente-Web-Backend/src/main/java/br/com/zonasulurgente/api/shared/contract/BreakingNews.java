package br.com.zonasulurgente.api.shared.contract;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Item da faixa de urgentes. */
public record BreakingNews(UUID id, String slug, String title, Category category,
		OffsetDateTime publishedAt) {
}
