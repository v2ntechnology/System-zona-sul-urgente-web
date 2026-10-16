import { cacheLife, cacheTag } from "next/cache";

import { cacheTags } from "@/lib/cache-tags";
import { apiGet, apiGetOrBadRequest } from "@/services/api/client";
import type {
  BreakingNews,
  Category,
  City,
  MostReadPeriod,
  Neighborhood,
  News,
  NewsSummary,
  Page,
  Author,
  Tag,
} from "@/types/news";

// Chamadas à API pública com cache do Next (BE-004/BE-011). Cada função tem cacheLife
// explícito e as tags de src/lib/cache-tags.ts: a API chama /api/revalidate com as mesmas
// strings quando uma notícia é publicada/editada, e o site atualiza na hora. O tempo é só
// rede de segurança. Funções com cursor/busca devolvem o 400 como valor: o service usa unwrap().

type FeaturedResponse = { main: NewsSummary; secondary: NewsSummary[] };

export async function latest(cursor: string | null | undefined, limit: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.newsList(), cacheTags.home());
  return apiGetOrBadRequest<Page<NewsSummary>>("/news", { cursor, limit });
}

export async function breaking() {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.breaking());
  return (await apiGet<BreakingNews[]>("/news/breaking")) ?? [];
}

export async function featured() {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.home());
  return apiGet<FeaturedResponse>("/news/featured");
}

export async function videos(limit: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.home(), cacheTags.newsList());
  return (await apiGet<NewsSummary[]>("/news/videos", { limit })) ?? [];
}

export async function mostRead(period: MostReadPeriod, limit: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.newsList());
  return (await apiGet<NewsSummary[]>("/news/most-read", { period, limit })) ?? [];
}

export async function bySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.news(slug));
  return apiGet<News>(`/news/${encodeURIComponent(slug)}`);
}

export async function byCategory(slug: string, cursor: string | null | undefined, limit: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.category(slug), cacheTags.newsList());
  return apiGetOrBadRequest<{ category: Category; page: Page<NewsSummary> }>(
    `/categories/${encodeURIComponent(slug)}/news`,
    { cursor, limit },
  );
}

export async function byNeighborhood(
  slug: string,
  cursor: string | null | undefined,
  limit: number,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.neighborhood(slug), cacheTags.newsList());
  return apiGetOrBadRequest<{ neighborhood: Neighborhood; page: Page<NewsSummary> }>(
    `/neighborhoods/${encodeURIComponent(slug)}/news`,
    { cursor, limit },
  );
}

export async function byCity(slug: string, cursor: string | null | undefined, limit: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.city(slug), cacheTags.newsList());
  return apiGetOrBadRequest<{ city: City; page: Page<NewsSummary> }>(
    `/cities/${encodeURIComponent(slug)}/news`,
    {
      cursor,
      limit,
    },
  );
}

export async function latestColumns(limit: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.home(), cacheTags.category("colunas"));
  return (
    (await apiGet<{ column: Category; latest: NewsSummary }[]>("/columns/latest", { limit })) ?? []
  );
}

/** Busca: termo livre, cache curto (cada combinação vira uma entrada). */
export async function search(
  query: string,
  categorySlug: string | undefined,
  neighborhoodSlug: string | undefined,
  cursor: string | null | undefined,
  limit: number,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.newsList());
  return apiGetOrBadRequest<Page<NewsSummary>>("/search", {
    q: query,
    category: categorySlug,
    neighborhood: neighborhoodSlug,
    cursor,
    limit,
  });
}

export type ApiResolved =
  | { type: "category"; category: Category }
  | { type: "news"; news: News; canonicalPath: string }
  | { type: "redirect"; location: string };

export async function resolve(path: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.newsList(), `path:${path}`.slice(0, 256));
  return apiGet<ApiResolved>("/resolve", { path });
}

export async function feed(categorySlug: string | undefined, limit: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.newsList(), ...(categorySlug ? [cacheTags.category(categorySlug)] : []));
  return apiGet<News[]>("/news/feed", { category: categorySlug, limit });
}

export async function sitemap(recentHours: number | undefined) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.newsList());
  return (await apiGet<NewsSummary[]>("/news/sitemap", { recentHours, limit: 5000 })) ?? [];
}

export async function categories() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.taxonomy());
  return (await apiGet<Category[]>("/categories")) ?? [];
}

export async function neighborhoods() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.taxonomy());
  return (await apiGet<Neighborhood[]>("/neighborhoods")) ?? [];
}

export async function authors() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.taxonomy());
  return (await apiGet<Author[]>("/authors")) ?? [];
}

export async function tags() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.taxonomy());
  return (await apiGet<Tag[]>("/tags")) ?? [];
}

export async function popularTags(limit: number) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.taxonomy());
  return (await apiGet<Tag[]>("/tags/popular", { limit })) ?? [];
}
