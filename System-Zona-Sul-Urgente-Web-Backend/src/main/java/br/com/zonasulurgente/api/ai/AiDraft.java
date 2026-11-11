package br.com.zonasulurgente.api.ai;

import java.util.List;

/**
 * Rascunho gerado pela IA, já dentro dos limites do editor. {@code categorySlug} e {@code neighborhoodSlug} são
 * sugestões (null quando a IA não escolheu um valor válido); o editor sempre revisa antes de publicar.
 * {@code advertising}: o post parece publicidade (a importação pode ignorar, ARCHITECTURE §6).
 * {@code generatedBy}: fornecedor e modelo que de fato escreveram (o reserva, quando o principal falhou).
 */
public record AiDraft(
		String title,
		String subtitle,
		String summary,
		List<String> paragraphs,
		String categorySlug,
		String neighborhoodSlug,
		List<String> tags,
		boolean urgent,
		boolean advertising,
		String generatedBy) {

	public AiDraft {
		paragraphs = List.copyOf(paragraphs);
		tags = List.copyOf(tags);
	}

}
