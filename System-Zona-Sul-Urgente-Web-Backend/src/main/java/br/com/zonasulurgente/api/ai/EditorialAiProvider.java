package br.com.zonasulurgente.api.ai;

/**
 * Fornecedor da IA editorial (ARCHITECTURE §6). Trocar de fornecedor ou de modelo é trocar a implementação; o
 * domínio de notícias só conhece esta interface. A saída já vem validada ({@link AiDraftValidator}).
 */
public interface EditorialAiProvider {

	/** Fornecedor e modelo principal, para log (quem escreveu cada rascunho: {@link AiDraft#generatedBy()}). */
	String name();

	/**
	 * Rascunho de notícia a partir de um post (Instagram). Só reorganiza o que está no post: não inventa fatos.
	 *
	 * @throws AiOutputException a IA respondeu algo fora das regras (o editor reprocessa ou escreve à mão)
	 * @throws AiUnavailableException a IA não respondeu (rede, limite de uso, erro do fornecedor)
	 */
	AiDraft draftFromPost(SourcePost post, EditorialContext context);

}
