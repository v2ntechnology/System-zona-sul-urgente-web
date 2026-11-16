"use server";

import { revalidateTag } from "next/cache";

import { cacheTags } from "@/lib/cache-tags";
import { adminFetch } from "@/services/admin/admin-api";
import { listAdminNews } from "@/services/admin/admin-service";
import { toFeaturedNews } from "@/services/admin/home-featured-service";
import { apiBaseUrl } from "@/services/api/client";
import { getLatest } from "@/services/news-service";
import type { HomeFeatured, HomeFeaturedNews } from "@/types/admin";

// Destaques da home (spec 003). A API confere a permissão (news.publish), as regras (só publicadas,
// patrocinada fora da manchete) e o conflito pela assinatura. Ao salvar, a home é atualizada na hora
// aqui no Next (tag "home"); a API também avisa por /api/revalidate.

export type FeaturedResult =
  | { ok: true; featured: HomeFeatured }
  | { ok: false; message: string; conflict?: HomeFeatured }
  | { ok: false; message: "simulated" };

const SIMULATED = { ok: false, message: "simulated" } as const;

export async function saveHomeFeatured(
  ids: (string | null)[],
  signature: string,
): Promise<FeaturedResult> {
  if (!apiBaseUrl()) return SIMULATED;
  const result = await adminFetch<HomeFeatured>("/home/featured", {
    method: "PUT",
    body: { ids, signature },
  });
  if (result.ok) {
    revalidateTag(cacheTags.home(), { expire: 0 });
    return { ok: true, featured: result.data };
  }
  const conflict =
    result.status === 409 ? (result.problem?.current as HomeFeatured | undefined) : undefined;
  return { ok: false, message: result.message, conflict };
}

/** Notícias publicadas para pôr no topo (busca por título ou autor). */
export async function searchPublishedNews(query: string): Promise<HomeFeaturedNews[]> {
  if (!apiBaseUrl()) {
    const q = query.trim().toLowerCase();
    const page = await getLatest({ limit: 50 });
    return page.items
      .filter((n) => !q || n.title.toLowerCase().includes(q))
      .slice(0, 20)
      .map(toFeaturedNews);
  }
  const page = await listAdminNews({
    query: query.trim() || undefined,
    status: "PUBLISHED",
    pageSize: 20,
  });
  return page.items.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    imageUrl: row.imageUrl ?? null,
    category: row.category.name,
    publishedAt: row.publishedAt ?? row.updatedAt,
    isSponsored: row.isSponsored,
    isUrgent: row.isUrgent,
  }));
}
