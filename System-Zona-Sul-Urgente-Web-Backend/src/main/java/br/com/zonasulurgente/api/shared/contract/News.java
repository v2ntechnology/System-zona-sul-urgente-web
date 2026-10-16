package br.com.zonasulurgente.api.shared.contract;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;

/**
 * Matéria completa. {@code body} e {@code video} saem como o JSON guardado no banco
 * (blocos ArticleBlock já sanitizados na gravação).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record News(UUID id, String slug, String title, String subtitle, String summary,
		Category category, NewsLocation location, MediaAsset image, boolean hasVideo, boolean isUrgent,
		boolean isSponsored, OffsetDateTime publishedAt, OffsetDateTime updatedAt, List<Author> authors,
		List<Tag> tags, @JsonRawValue String body, @JsonRawValue String video, Sponsor sponsor,
		int readingTimeMinutes, String origin, NewsSeo seo, List<NewsSummary> related) {

	public static News of(NewsSummary s, List<Author> authors, List<Tag> tags, String body,
			String video, Sponsor sponsor, int readingTimeMinutes, String origin, NewsSeo seo,
			List<NewsSummary> related) {
		return new News(s.id(), s.slug(), s.title(), s.subtitle(), s.summary(), s.category(),
				s.location(), s.image(), s.hasVideo(), s.isUrgent(), s.isSponsored(), s.publishedAt(),
				s.updatedAt(), authors, tags, body, video, sponsor, readingTimeMinutes, origin, seo,
				related);
	}

}
