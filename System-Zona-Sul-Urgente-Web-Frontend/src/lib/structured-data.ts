import type { BreadcrumbList, NewsArticle, WithContext } from "schema-dts";

import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import type { News } from "@/types/news";

// Dados estruturados (Schema.org) para SEO de notícias (FE-113).

export const absoluteUrl = (path: string) => new URL(path, siteConfig.url).toString();

export type Crumb = { name: string; path: string };

export function newsBreadcrumbs(news: Pick<News, "title" | "slug" | "category">): Crumb[] {
  const { category } = news;
  return [
    { name: "Início", path: routes.home },
    ...(category.parent
      ? [{ name: category.parent.name, path: routes.category(category.parent) }]
      : []),
    { name: category.name, path: routes.category(category) },
    { name: news.title, path: routes.news(news) },
  ];
}

export function breadcrumbJsonLd(crumbs: Crumb[]): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function newsArticleJsonLd(news: News): WithContext<NewsArticle> {
  const url = absoluteUrl(routes.news(news));
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: news.title,
    description: news.seo?.description ?? news.summary,
    image: news.image ? [news.image.url] : undefined,
    datePublished: news.publishedAt,
    dateModified: news.updatedAt ?? news.publishedAt,
    mainEntityOfPage: url,
    url,
    articleSection: news.category.parent?.name ?? news.category.name,
    keywords: news.tags.map((tag) => tag.name).join(", ") || undefined,
    isAccessibleForFree: true,
    author: news.authors.map((author) => ({ "@type": "Person", name: author.name })),
    publisher: { "@type": "NewsMediaOrganization", name: siteConfig.name, url: siteConfig.url },
    ...(news.sponsor && { sponsor: { "@type": "Organization", name: news.sponsor.name } }),
  };
}

/** JSON-LD seguro para <script>: `<` vira < (evita fechar a tag com </script>). */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
