import { featuredRank, newsMock } from "@/mocks/news";
import { adminGet } from "@/services/admin/admin-api";
import { apiBaseUrl } from "@/services/api/client";
import type { HomeFeatured, HomeFeaturedNews } from "@/types/admin";
import type { NewsSummary } from "@/types/news";

// Destaques da home no painel (spec 003). Com API_URL: GET /api/v1/admin/home/featured; sem ela, o topo
// dos dados de exemplo (o mesmo que a home do modo demonstração mostra).

const POSITIONS = 10;

export function toFeaturedNews(n: NewsSummary): HomeFeaturedNews {
  return {
    id: n.id,
    slug: n.slug,
    title: n.title,
    imageUrl: n.image?.url ?? null,
    category: n.category.name,
    publishedAt: n.publishedAt,
    isSponsored: n.isSponsored,
    isUrgent: n.isUrgent,
  };
}

export async function getHomeFeatured(): Promise<HomeFeatured | null> {
  if (apiBaseUrl()) return adminGet<HomeFeatured>("/home/featured");
  const byRank = new Map<number, HomeFeaturedNews>();
  for (const n of newsMock) {
    const rank = featuredRank.get(n.slug);
    if (rank && rank <= POSITIONS) byRank.set(rank, toFeaturedNews(n));
  }
  const slots = Array.from({ length: POSITIONS }, (_, i) => ({
    position: i + 1,
    news: byRank.get(i + 1) ?? null,
  }));
  const automatic = byRank.has(1)
    ? null
    : (newsMock
        .filter((n) => !n.isSponsored)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .map(toFeaturedNews)[0] ?? null);
  return { slots, automaticMain: automatic, signature: "demonstracao" };
}
