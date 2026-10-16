package br.com.zonasulurgente.api.news.admin;

import java.text.Normalizer;

/** Mesma normalização do frontend (src/lib/editor/tags.ts): sem acento, caixa ou plural simples. */
final class TagKeys {

	private TagKeys() {
	}

	static String slug(String value) {
		String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
		return ascii.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
	}

	static String key(String value) {
		var out = new StringBuilder();
		for (String word : slug(value).split("-")) {
			if (!out.isEmpty()) {
				out.append('-');
			}
			out.append(word.length() > 3 && word.endsWith("s") ? word.substring(0, word.length() - 1) : word);
		}
		return out.toString();
	}

}
