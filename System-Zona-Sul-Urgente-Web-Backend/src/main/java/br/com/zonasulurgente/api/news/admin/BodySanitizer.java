package br.com.zonasulurgente.api.news.admin;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;

import tools.jackson.databind.JsonNode;

/**
 * Corpo da matéria vindo do editor, revisado no servidor (nunca confiar no navegador): só os
 * blocos que o site exibe; no HTML dos parágrafos, só strong, em e links http(s)/mailto/
 * relativos. Gera também o texto puro (busca) e a contagem de palavras (tempo de leitura).
 */
final class BodySanitizer {

	private static final Safelist PARAGRAPH = Safelist.none()
		.addTags("strong", "em", "a")
		.addAttributes("a", "href")
		.addProtocols("a", "href", "http", "https", "mailto")
		.preserveRelativeLinks(true);
	private static final int MAX_BLOCKS = 300;

	record Result(List<Map<String, Object>> blocks, String text, int words, boolean hasParagraph) {
	}

	private BodySanitizer() {
	}

	static Result sanitize(JsonNode body) {
		List<Map<String, Object>> blocks = new ArrayList<>();
		var text = new StringBuilder();
		if (body != null && body.isArray()) {
			for (JsonNode block : body) {
				if (blocks.size() >= MAX_BLOCKS) {
					break;
				}
				Map<String, Object> clean = block(block);
				if (clean != null) {
					blocks.add(clean);
					text.append(plain(clean)).append('\n');
				}
			}
		}
		String all = text.toString().strip();
		int words = all.isEmpty() ? 0 : all.split("\\s+").length;
		boolean hasParagraph = blocks.stream()
			.anyMatch(b -> "paragraph".equals(b.get("type")) && !plain(b).isBlank());
		return new Result(blocks, all, words, hasParagraph);
	}

	private static Map<String, Object> block(JsonNode b) {
		String type = b.path("type").asString("");
		Map<String, Object> out = new LinkedHashMap<>();
		out.put("type", type);
		switch (type) {
			case "paragraph" -> {
				String html = Jsoup.clean(b.path("html").asString(""), "https://zonasulurgente.local", PARAGRAPH)
					.strip();
				if (html.isEmpty()) {
					return null;
				}
				out.put("html", html);
			}
			case "heading" -> {
				String text = text(b.path("text").asString(""));
				if (text.isEmpty()) {
					return null;
				}
				out.put("text", text);
			}
			case "quote" -> {
				String text = text(b.path("text").asString(""));
				if (text.isEmpty()) {
					return null;
				}
				out.put("text", text);
				String source = text(b.path("source").asString(""));
				if (!source.isEmpty()) {
					out.put("source", source);
				}
			}
			case "list" -> {
				List<String> items = new ArrayList<>();
				for (JsonNode item : b.path("items")) {
					String text = text(item.asString(""));
					if (!text.isEmpty()) {
						items.add(text);
					}
				}
				if (items.isEmpty()) {
					return null;
				}
				out.put("ordered", b.path("ordered").asBoolean(false));
				out.put("items", items);
			}
			default -> {
				// Imagem/vídeo no meio do texto entram com o armazenamento de mídia (BE-012).
				return null;
			}
		}
		return out;
	}

	private static String text(String value) {
		return Jsoup.parse(value).text().strip();
	}

	@SuppressWarnings("unchecked")
	private static String plain(Map<String, Object> b) {
		return switch ((String) b.get("type")) {
			case "paragraph" -> Jsoup.parse((String) b.get("html")).text();
			case "list" -> String.join(" ", (List<String>) b.get("items"));
			default -> (String) b.getOrDefault("text", "");
		};
	}

}
