import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { buildRss, RSS_HEADERS } from "@/lib/rss";
import { getNewsForFeed } from "@/services/news-service";
import { getCategories } from "@/services/taxonomy-service";

// RSS por editoria (FE-114): /feed/{slug}.xml — inclui as subeditorias.
export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ file: `${c.slug}.xml` }));
}

export async function GET(_request: Request, { params }: RouteContext<"/feed/[file]">) {
  const { file } = await params;
  const slug = file.endsWith(".xml") ? file.slice(0, -4) : null;
  const category = slug ? (await getCategories()).find((c) => c.slug === slug) : undefined;
  const items = category ? await getNewsForFeed(category.slug) : null;
  if (!category || !items) return new Response("Feed não encontrado", { status: 404 });

  const xml = buildRss({
    title: `${category.name} | ${siteConfig.name}`,
    description: category.description ?? `Notícias de ${category.name} no ${siteConfig.name}.`,
    pagePath: routes.category(category),
    feedPath: routes.feed(category.slug),
    items,
  });
  return new Response(xml, { headers: RSS_HEADERS });
}
