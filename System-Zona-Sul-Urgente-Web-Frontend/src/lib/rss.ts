import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { escapeHtml as esc } from "@/lib/html";
import { absoluteUrl } from "@/lib/structured-data";
import type { News } from "@/types/news";

type FeedOptions = {
  title: string;
  description: string;
  /** Página HTML equivalente ao feed (home ou editoria). */
  pagePath: string;
  /** Caminho do próprio feed (atom:link rel="self"). */
  feedPath: string;
  items: News[];
};

/** RSS 2.0 (FE-114) com imagem (media:content) e autores (dc:creator). */
export function buildRss({ title, description, pagePath, feedPath, items }: FeedOptions): string {
  const lastBuild = items[0] ? rfc822(items[0].updatedAt ?? items[0].publishedAt) : undefined;

  const entries = items
    .map((news) => {
      const link = absoluteUrl(routes.news(news));
      const authors = news.authors
        .map((a) => `      <dc:creator>${esc(a.name)}</dc:creator>`)
        .join("\n");
      const image = news.image
        ? `
      <media:content url="${esc(news.image.url)}" medium="image" type="image/jpeg" width="${news.image.width}" height="${news.image.height}">
        <media:description>${esc(news.image.alt)}</media:description>
      </media:content>`
        : "";
      return `    <item>
      <title>${esc(news.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(news.id)}</guid>
      <pubDate>${rfc822(news.publishedAt)}</pubDate>
      <description>${esc(news.summary)}</description>
      <category>${esc(news.category.name)}</category>
${authors}${image}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(absoluteUrl(pagePath))}</link>
    <description>${esc(description)}</description>
    <language>pt-BR</language>
    <copyright>© ${esc(siteConfig.name)}</copyright>
    <atom:link href="${esc(absoluteUrl(feedPath))}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${esc(absoluteUrl("/brand/logo-512.png"))}</url>
      <title>${esc(title)}</title>
      <link>${esc(absoluteUrl(pagePath))}</link>
    </image>${lastBuild ? `\n    <lastBuildDate>${lastBuild}</lastBuildDate>` : ""}
${entries}
  </channel>
</rss>
`;
}

/** Data no formato exigido pelo RSS 2.0 (RFC 822), ex.: "Thu, 15 Oct 2026 17:30:00 GMT". */
export function rfc822(iso: string): string {
  return new Date(iso).toUTCString();
}

export const RSS_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  // Agregadores consultam com frequência; a CDN absorve. Publicação revalida pela tag.
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
};
