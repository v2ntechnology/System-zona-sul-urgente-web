import type { MetadataRoute } from "next";

import { routes } from "@/config/navigation";
import { absoluteUrl } from "@/lib/structured-data";
import { getNewsForSitemap } from "@/services/news-service";
import { getLatestStories } from "@/services/story-service";
import { getCategories, getNeighborhoods } from "@/services/taxonomy-service";

// Sitemap geral (FE-113): home, editorias, bairros, matérias (com imagem) e web stories.
// O de Google Notícias (últimas 48 h) fica em /news-sitemap.xml.
// Limite do protocolo: 50 mil URLs por arquivo — com o acervo crescendo, dividir com
// generateSitemaps (por mês de publicação).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, categories, neighborhoods, stories] = await Promise.all([
    getNewsForSitemap(),
    getCategories(),
    getNeighborhoods(),
    getLatestStories(1000),
  ]);

  const lastNews = news
    .map((n) => n.updatedAt ?? n.publishedAt)
    .sort()
    .at(-1);
  const latestIn = (match: (n: (typeof news)[number]) => boolean) =>
    news
      .filter(match)
      .map((n) => n.updatedAt ?? n.publishedAt)
      .sort()
      .at(-1) ?? lastNews;

  return [
    {
      url: absoluteUrl(routes.home),
      lastModified: lastNews,
      changeFrequency: "always",
      priority: 1,
    },
    ...categories.map((category) => ({
      url: absoluteUrl(routes.category(category)),
      lastModified: latestIn(
        (n) => n.category.slug === category.slug || n.category.parent?.slug === category.slug,
      ),
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...neighborhoods.map((neighborhood) => ({
      url: absoluteUrl(routes.neighborhood(neighborhood.slug)),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...news.map((item) => ({
      url: absoluteUrl(routes.news(item)),
      lastModified: item.updatedAt ?? item.publishedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: item.image ? [item.image.url] : undefined,
    })),
    ...stories.map((story) => ({
      url: absoluteUrl(routes.story(story.slug)),
      lastModified: story.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
