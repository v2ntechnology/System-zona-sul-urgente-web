import type { News } from "@/types/news";

/**
 * "Pesquisas relacionadas" (estilo CNN): termos de busca montados a partir dos tópicos,
 * do bairro e da editoria da matéria. Sem repetição, no máximo `limit`.
 * Quando houver analytics de busca (BE-015), trocar pelos termos mais buscados de verdade.
 */
export function relatedSearches(
  news: Pick<News, "tags" | "category" | "location">,
  limit = 5,
): string[] {
  const place = news.location?.neighborhood?.name;
  const candidates = [
    ...news.tags.map((tag) => (place ? `${tag.name} ${place}` : tag.name)),
    place && `${news.category.name} ${place}`,
    ...news.tags.map((tag) => tag.name),
    place && `Notícias ${place}`,
    news.category.name,
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of candidates) {
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(term);
    if (result.length === limit) break;
  }
  return result;
}
