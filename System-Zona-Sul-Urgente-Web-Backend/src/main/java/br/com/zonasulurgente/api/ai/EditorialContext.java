package br.com.zonasulurgente.api.ai;

import java.util.List;

/**
 * O que a IA pode escolher: editorias e bairros que existem no site. Sugestão fora da lista é descartada.
 */
public record EditorialContext(List<Option> categories, List<Option> neighborhoods) {

	public record Option(String slug, String name) {
	}

	public EditorialContext {
		categories = List.copyOf(categories);
		neighborhoods = List.copyOf(neighborhoods);
	}

}
