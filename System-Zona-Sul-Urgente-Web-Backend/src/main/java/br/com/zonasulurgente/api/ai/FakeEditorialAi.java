package br.com.zonasulurgente.api.ai;

import static br.com.zonasulurgente.api.news.admin.DraftValidator.SUMMARY_MAX;
import static br.com.zonasulurgente.api.news.admin.DraftValidator.TITLE_MAX;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * IA falsa: sem rede e sempre a mesma saída para o mesmo post. Usada nos testes e em desenvolvimento sem
 * GEMINI_API_KEY. O texto é o próprio post reorganizado, sem nenhuma reescrita.
 */
class FakeEditorialAi implements EditorialAiProvider {

	@Override
	public String name() {
		return "fake";
	}

	@Override
	public AiDraft draftFromPost(SourcePost post, EditorialContext context) {
		String text = post.text() == null ? "" : post.text().replaceAll("[#@]\\S+", "").strip();
		List<String> paragraphs = Arrays.stream(text.split("\\n\\s*\\n"))
			.map(p -> p.replaceAll("\\s+", " ").strip())
			.filter(p -> !p.isEmpty())
			.toList();
		if (paragraphs.isEmpty()) {
			throw new AiOutputException("campo paragrafos vazio");
		}
		String first = paragraphs.getFirst();
		String title = cut(first.split("(?<=[.!?])\\s")[0].replaceAll("[.!]+$", ""), TITLE_MAX);
		String category = context.categories().isEmpty() ? null : context.categories().getFirst().slug();
		String lower = text.toLowerCase(Locale.ROOT);
		return new AiDraft(title, "", cut(first, SUMMARY_MAX), paragraphs, category, null, List.of(),
				lower.contains("urgente"), lower.contains("publi"), name());
	}

	private static String cut(String value, int max) {
		return value.length() <= max ? value : value.substring(0, max - 1).strip() + "…";
	}

}
