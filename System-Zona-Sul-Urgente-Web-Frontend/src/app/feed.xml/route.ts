import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { buildRss, RSS_HEADERS } from "@/lib/rss";
import { getNewsForFeed } from "@/services/news-service";

// RSS geral do portal (FE-114).
export async function GET() {
  const items = (await getNewsForFeed()) ?? [];
  const xml = buildRss({
    title: siteConfig.name,
    description: siteConfig.description,
    pagePath: routes.home,
    feedPath: routes.feed(),
    items,
  });
  return new Response(xml, { headers: RSS_HEADERS });
}
