package br.com.zonasulurgente.api.news.admin;

import java.util.UUID;

/**
 * Notícia criada, editada, publicada, despublicada ou excluída — disparado após o commit.
 * A revalidação do site (BE-011: /api/revalidate no Next + purga na CDN) e o push escutam isto.
 */
public record NewsChangedEvent(UUID newsId, String slug, String previousSlug, String status,
		String previousStatus) {

	/** Mudou algo que o leitor vê (estava ou ficou no ar)? */
	public boolean affectsSite() {
		return "PUBLISHED".equals(status) || "PUBLISHED".equals(previousStatus);
	}

}
