package br.com.zonasulurgente.api.news.admin;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import tools.jackson.databind.JsonNode;

/**
 * Notícia em edição — espelho do {@code NewsDraft} do editor (src/types/admin.ts). Referências
 * por slug (a API resolve os IDs). {@code version}: bloqueio otimista (quem salvou por último
 * não apaga a edição de outra pessoa sem saber).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record NewsDraft(UUID id, String title, String subtitle, String summary, JsonNode body,
		String categorySlug, List<String> authorSlugs, String neighborhoodSlug, List<String> tagSlugs,
		List<String> newTags, Image image, boolean isUrgent, boolean isSponsored, String sponsorName, Seo seo,
		String status, String scheduledFor, String origin, String instagramCaption, OffsetDateTime updatedAt,
		Integer version) {

	public record Image(String url, String alt, String caption, String credit) {
	}

	public record Seo(String title, String description) {
	}

	/** Saída: o corpo vai como o JSON guardado (já sanitizado). */
	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record Out(UUID id, String title, String subtitle, String summary, @JsonRawValue String body,
			String categorySlug, List<String> authorSlugs, String neighborhoodSlug, List<String> tagSlugs,
			List<String> newTags, Image image, boolean isUrgent, boolean isSponsored, String sponsorName, Seo seo,
			String status, String scheduledFor, String origin, String instagramCaption, OffsetDateTime updatedAt,
			int version) {
	}

}
