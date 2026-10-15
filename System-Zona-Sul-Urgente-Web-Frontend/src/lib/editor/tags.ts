import { slugify } from "@/config/navigation";

type TagOption = { slug: string; name: string };

export const TAG_LIMITS = { name: { min: 2, max: 40 }, perNews: 10 };

/** Chave de comparação: sem acento, caixa ou plural simples ("Tiroteios" = "tiroteio"). */
export function tagKey(value: string): string {
  return slugify(value)
    .split("-")
    .map((word) => (word.length > 3 ? word.replace(/s$/, "") : word))
    .join("-");
}

/** Espaços extras removidos; mantém a grafia escolhida pelo jornalista. */
export function cleanTagName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Tópicos existentes parecidos com o texto digitado, os que começam igual primeiro.
 * `existing` é o tópico que já tem o mesmo nome (então não se oferece criar outro).
 */
export function matchTags(
  query: string,
  options: TagOption[],
  exclude: string[] = [],
  limit = 6,
): { matches: TagOption[]; existing?: TagOption } {
  const key = tagKey(query);
  if (!key) return { matches: [] };
  const existing = options.find((t) => tagKey(t.name) === key || tagKey(t.slug) === key);
  const scored = options
    .filter((t) => !exclude.includes(t.slug))
    .map((t) => {
      const k = tagKey(t.name);
      return { t, score: k.startsWith(key) ? 0 : k.includes(key) || key.includes(k) ? 1 : 2 };
    })
    .filter(({ score }) => score < 2)
    .sort((a, b) => a.score - b.score || a.t.name.localeCompare(b.t.name, "pt-BR"));
  return { matches: scored.slice(0, limit).map(({ t }) => t), existing };
}

/** Erro do nome de um tópico novo, ou `null` se estiver ok. */
export function newTagError(name: string): string | null {
  const clean = cleanTagName(name);
  if (clean.length < TAG_LIMITS.name.min)
    return `Tópico precisa de pelo menos ${TAG_LIMITS.name.min} letras.`;
  if (clean.length > TAG_LIMITS.name.max)
    return `Tópico com no máximo ${TAG_LIMITS.name.max} caracteres.`;
  if (!slugify(clean)) return "Use letras ou números no nome do tópico.";
  return null;
}
