import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { escapeHtml as esc } from "@/lib/html";
import { absoluteUrl } from "@/lib/structured-data";
import { getNewsForNewsSitemap } from "@/services/news-service";

// Sitemap do Google Notícias (FE-113): só matérias das últimas 48 h, com a extensão news:.
// O MetadataRoute.Sitemap do Next não suporta essa extensão, por isso a rota própria.
// Spec: developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
export async function GET() {
  const items = await getNewsForNewsSitemap();
  const urls = items
    .map(
      (item) => `  <url>
    <loc>${esc(absoluteUrl(routes.news(item)))}</loc>
    <news:news>
      <news:publication>
        <news:name>${esc(siteConfig.name)}</news:name>
        <news:language>pt</news:language>
      </news:publication>
      <news:publication_date>${esc(item.publishedAt)}</news:publication_date>
      <news:title>${esc(item.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
