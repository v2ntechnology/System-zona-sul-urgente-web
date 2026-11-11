package br.com.zonasulurgente.api.audit;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Diff resumido da auditoria: só os campos que mudaram, como {"campo": {"from": antes, "to": depois}}.
 * Texto longo é truncado (com o tamanho total) e campos com nome de segredo viram "[oculto]".
 */
public final class AuditDiff {

	static final int TEXT_MAX = 200;
	static final int LIST_MAX = 20;
	static final String HIDDEN = "[oculto]";
	private static final Pattern SECRET = Pattern
		.compile("(?i).*(password|senha|token|secret|segredo|chave|apikey|api_key|hash|totp|otp).*");

	private AuditDiff() {
	}

	/** Campos de {@code after} (e de {@code before}) cujo valor mudou. */
	public static Map<String, Object> between(Map<String, ?> before, Map<String, ?> after) {
		Map<String, Object> diff = new LinkedHashMap<>();
		List<String> keys = new ArrayList<>(after.keySet());
		before.keySet().stream().filter(k -> !after.containsKey(k)).forEach(keys::add);
		for (String key : keys) {
			Object from = normalize(before.get(key));
			Object to = normalize(after.get(key));
			if (!Objects.equals(from, to)) {
				Map<String, Object> change = new LinkedHashMap<>();
				change.put("from", summarize(key, from));
				change.put("to", summarize(key, to));
				diff.put(key, change);
			}
		}
		return diff;
	}

	/** Entidade nova: os campos preenchidos, como mudança a partir do nada. */
	public static Map<String, Object> created(Map<String, ?> after) {
		return between(Map.of(), after);
	}

	/** Um campo só: {"campo": {"from": antes, "to": depois}} (vazio se não mudou). */
	public static Map<String, Object> field(String key, Object from, Object to) {
		Map<String, Object> before = new LinkedHashMap<>();
		before.put(key, from);
		Map<String, Object> after = new LinkedHashMap<>();
		after.put(key, to);
		return between(before, after);
	}

	static Object summarize(String key, Object value) {
		if (value == null) {
			return null;
		}
		if (key != null && SECRET.matcher(key).matches()) {
			return HIDDEN;
		}
		if (value instanceof CharSequence text) {
			String s = text.toString();
			return s.length() <= TEXT_MAX ? s : s.substring(0, TEXT_MAX) + "… (" + s.length() + " caracteres)";
		}
		if (value instanceof Collection<?> list) {
			List<Object> out = new ArrayList<>();
			for (Object item : list) {
				if (out.size() == LIST_MAX) {
					out.add("… (+" + (list.size() - LIST_MAX) + ")");
					break;
				}
				out.add(summarize(null, item));
			}
			return out;
		}
		if (value instanceof Number || value instanceof Boolean) {
			return value;
		}
		return summarize(null, value.toString());
	}

	/** Vazio e nulo valem o mesmo (texto em branco não é mudança). */
	private static Object normalize(Object value) {
		if (value instanceof CharSequence text && text.toString().isBlank()) {
			return null;
		}
		if (value instanceof Collection<?> list && list.isEmpty()) {
			return null;
		}
		return value;
	}

}
