package br.com.zonasulurgente.api.news.admin;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Mesmas regras de src/lib/editor/validate.ts (o editor confere antes; aqui é a garantia).
 * Rascunho só exige título; revisão/publicação/agendamento exigem a matéria completa.
 */
final class DraftValidator {

	static final ZoneId BRASILIA = ZoneId.of("America/Sao_Paulo");
	static final int TITLE_MIN = 10;
	static final int TITLE_MAX = 120;
	static final int SUBTITLE_MAX = 200;
	static final int SUMMARY_MIN = 30;
	static final int SUMMARY_MAX = 300;
	static final int SEO_TITLE_MAX = 70;
	static final int SEO_DESCRIPTION_MAX = 170;
	static final int TAGS_MAX = 10;
	static final int TAG_NAME_MIN = 2;
	static final int TAG_NAME_MAX = 40;

	private DraftValidator() {
	}

	static Map<String, String> validate(NewsDraft d, String intent, boolean hasParagraph, OffsetDateTime now) {
		Map<String, String> e = new LinkedHashMap<>();
		String title = trim(d.title());
		if (title.isEmpty()) {
			e.put("title", "Informe o título.");
		}
		else if (title.length() > TITLE_MAX) {
			e.put("title", "Máximo de " + TITLE_MAX + " caracteres.");
		}
		if (trim(d.subtitle()).length() > SUBTITLE_MAX) {
			e.put("subtitle", "Máximo de " + SUBTITLE_MAX + " caracteres.");
		}
		if (trim(d.summary()).length() > SUMMARY_MAX) {
			e.put("summary", "Máximo de " + SUMMARY_MAX + " caracteres.");
		}
		NewsDraft.Seo seo = d.seo();
		if (seo != null && (trim(seo.title()).length() > SEO_TITLE_MAX
				|| trim(seo.description()).length() > SEO_DESCRIPTION_MAX)) {
			e.put("seo", "Título ou descrição para o Google longos demais.");
		}
		List<String> newTags = d.newTags() == null ? List.of() : d.newTags();
		if (newTags.stream().anyMatch(t -> trim(t).length() < TAG_NAME_MIN || trim(t).length() > TAG_NAME_MAX)) {
			e.put("newTags", "Tópico com " + TAG_NAME_MIN + " a " + TAG_NAME_MAX + " letras.");
		}
		else if (size(d.tagSlugs()) + newTags.size() > TAGS_MAX) {
			e.put("newTags", "No máximo " + TAGS_MAX + " tópicos por matéria.");
		}
		if ("draft".equals(intent)) {
			return e;
		}

		if (!title.isEmpty() && title.length() < TITLE_MIN) {
			e.put("title", "Mínimo de " + TITLE_MIN + " caracteres.");
		}
		if (trim(d.summary()).length() < SUMMARY_MIN) {
			e.put("summary", "O resumo precisa de pelo menos " + SUMMARY_MIN
					+ " caracteres (aparece nos cards e no Google).");
		}
		if (!hasParagraph) {
			e.put("body", "Escreva o texto da matéria.");
		}
		if (trim(d.categorySlug()).isEmpty()) {
			e.put("categorySlug", "Escolha a editoria.");
		}
		if (size(d.authorSlugs()) == 0) {
			e.put("authorSlugs", "Escolha pelo menos um autor.");
		}
		NewsDraft.Image image = d.image();
		if (image == null || trim(image.url()).isEmpty()) {
			e.put("image.url", "Adicione a foto principal.");
		}
		else if (!image.url().matches("https://\\S+")) {
			e.put("image.url", "Use o endereço completo da imagem (https://).");
		}
		else if (trim(image.alt()).isEmpty()) {
			e.put("image.alt", "Descreva a foto (texto alternativo) para acessibilidade.");
		}
		if (d.isSponsored() && trim(d.sponsorName()).isEmpty()) {
			e.put("sponsorName", "Informe o patrocinador (identificação obrigatória).");
		}
		if ("schedule".equals(intent)) {
			OffsetDateTime when = scheduledFor(d.scheduledFor());
			if (when == null) {
				e.put("scheduledFor", "Escolha data e hora da publicação.");
			}
			else if (!when.isAfter(now)) {
				e.put("scheduledFor", "A data precisa estar no futuro.");
			}
		}
		return e;
	}

	/** "AAAA-MM-DDTHH:mm" no fuso de Brasília (input datetime-local do editor). */
	static OffsetDateTime scheduledFor(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		try {
			return LocalDateTime.parse(value).atZone(BRASILIA).toOffsetDateTime();
		}
		catch (DateTimeParseException ex) {
			return null;
		}
	}

	static String trim(String value) {
		return value == null ? "" : value.strip();
	}

	private static int size(List<?> list) {
		return list == null ? 0 : list.size();
	}

}
