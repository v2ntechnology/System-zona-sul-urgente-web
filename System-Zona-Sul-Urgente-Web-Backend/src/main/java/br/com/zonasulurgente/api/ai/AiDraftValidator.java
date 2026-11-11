package br.com.zonasulurgente.api.ai;

import static br.com.zonasulurgente.api.news.admin.DraftValidator.SUBTITLE_MAX;
import static br.com.zonasulurgente.api.news.admin.DraftValidator.SUMMARY_MAX;
import static br.com.zonasulurgente.api.news.admin.DraftValidator.TAG_NAME_MAX;
import static br.com.zonasulurgente.api.news.admin.DraftValidator.TAG_NAME_MIN;
import static br.com.zonasulurgente.api.news.admin.DraftValidator.TITLE_MAX;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import tools.jackson.databind.JsonNode;

/**
 * Confere a resposta da IA com os limites do editor (ARCHITECTURE §6: "Validação Spring Boot"). Campo
 * obrigatório vazio ou acima do limite recusa o rascunho; sugestões fora das listas viram null.
 */
final class AiDraftValidator {

	private AiDraftValidator() {
	}

	static AiDraft validate(JsonNode out, EditorialContext context, String generatedBy) {
		if (out == null || !out.isObject()) {
			throw new AiOutputException("a resposta não é um objeto JSON");
		}
		String title = required(out, "titulo", TITLE_MAX);
		String subtitle = optional(out, "subtitulo", SUBTITLE_MAX);
		String summary = required(out, "resumo", SUMMARY_MAX);

		List<String> paragraphs = new ArrayList<>();
		out.path("paragrafos").forEach(p -> {
			String text = p.asString().strip();
			if (!text.isEmpty()) {
				paragraphs.add(text);
			}
		});
		if (paragraphs.isEmpty()) {
			throw new AiOutputException("campo paragrafos vazio");
		}

		return new AiDraft(title, subtitle, summary, paragraphs,
				known(out, "editoria", context.categories()),
				known(out, "bairro", context.neighborhoods()),
				tags(out.path("topicos")),
				out.path("urgente").asBoolean(false),
				out.path("publicidade").asBoolean(false), generatedBy);
	}

	private static String required(JsonNode out, String field, int max) {
		String value = optional(out, field, max);
		if (value.isEmpty()) {
			throw new AiOutputException("campo " + field + " vazio");
		}
		return value;
	}

	private static String optional(JsonNode out, String field, int max) {
		String value = out.path(field).asString().strip();
		if (value.length() > max) {
			throw new AiOutputException("campo " + field + " com " + value.length() + " caracteres; máximo " + max);
		}
		return value;
	}

	/** Slug sugerido só vale se estiver na lista enviada à IA. */
	private static String known(JsonNode out, String field, List<EditorialContext.Option> options) {
		String slug = out.path(field).asString().strip();
		Set<String> allowed = options.stream().map(EditorialContext.Option::slug).collect(Collectors.toSet());
		return allowed.contains(slug) ? slug : null;
	}

	/** Tópicos curtos, sem repetição (ignora caixa e acento), no máximo {@link EditorialPrompt#TAGS_ASKED}. */
	private static List<String> tags(JsonNode node) {
		Map<String, String> byKey = new LinkedHashMap<>();
		node.forEach(t -> {
			String name = t.asString().strip().replaceFirst("^#", "");
			if (name.length() >= TAG_NAME_MIN && name.length() <= TAG_NAME_MAX) {
				byKey.putIfAbsent(key(name), name);
			}
		});
		return byKey.values().stream().limit(EditorialPrompt.TAGS_ASKED).toList();
	}

	private static String key(String name) {
		return java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD)
			.replaceAll("\\p{M}", "")
			.toLowerCase(Locale.ROOT);
	}

}
