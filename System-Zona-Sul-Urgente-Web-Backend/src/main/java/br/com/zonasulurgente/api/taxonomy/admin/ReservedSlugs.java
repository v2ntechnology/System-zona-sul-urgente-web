package br.com.zonasulurgente.api.taxonomy.admin;

import java.util.Set;

/**
 * Primeiros segmentos usados por rotas fixas do site: nunca podem ser editoria principal
 * (editorias ficam na raiz). Espelho de RESERVED_SLUGS em src/config/navigation.ts do
 * frontend — um teste de lá confere que as duas listas são iguais.
 */
final class ReservedSlugs {

	static final Set<String> ALL = Set.of(
			"admin",
			"article",
			"category",
			"search",
			"anuncie",
			"api",
			"ao-vivo",
			"offline",
			"autor",
			"bairro",
			"busca",
			"expediente",
			"feed",
			"privacidade",
			"quem-somos",
			"rss",
			"sitemap",
			"stories",
			"brand",
			"tag",
			"termos",
			"zona");

	private ReservedSlugs() {
	}

}
