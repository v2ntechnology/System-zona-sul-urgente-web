package br.com.zonasulurgente.api.news.admin;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.com.zonasulurgente.api.shared.contract.CategoryRef;

/** Linha da listagem do painel — espelho de AdminNewsRow (src/types/admin.ts). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdminNewsRow(UUID id, String slug, String title, String status, Category category,
		List<String> authors, String origin, boolean isUrgent, boolean isSponsored, OffsetDateTime updatedAt,
		OffsetDateTime publishedAt, OffsetDateTime scheduledFor, OffsetDateTime deletedAt, long views,
		String imageUrl) {

	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record Category(UUID id, String slug, String name, CategoryRef parent) {
	}

}
