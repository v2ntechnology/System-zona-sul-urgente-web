import Link from "next/link";

import { AdSlot } from "@/components/ads/ad-slot";
import { SectionHeader } from "@/components/home/section-header";
import { Container } from "@/components/layout/container";
import { MostRead } from "@/components/news/most-read";
import {
  NewsCard,
  NewsCardCompact,
  NewsCardFeatured,
  NewsCardHorizontal,
  NewsCardOverlay,
  NewsCardVideo,
} from "@/components/news/news-card";
import { routes } from "@/config/navigation";
import {
  getByCategory,
  getBySlug,
  getFeatured,
  getLatest,
  getVideos,
} from "@/services/news-service";
import { getNeighborhoods } from "@/services/taxonomy-service";
import type { NewsSummary } from "@/types/news";

// Home (FE-101), na estrutura da CNN: manchete + destaques, faixa compacta, últimas com
// "Mais lidas", faixa escura de vídeos, blocos por editoria e atalhos por bairro.
// Uma notícia aparece uma vez só (exceto na faixa de vídeos, que é outro formato).

const CATEGORY_BLOCKS = ["seguranca", "esportes", "economia"];

export default async function HomePage() {
  const [featured, latest, videos, neighborhoods, ...categoryResults] = await Promise.all([
    getFeatured(),
    getLatest({ limit: 30 }),
    getVideos(4),
    getNeighborhoods(),
    ...CATEGORY_BLOCKS.map((slug) => getByCategory(slug, { limit: 12 })),
  ]);

  const shown = new Set<string>();
  // Registra cada item ao escolher: a mesma notícia pode vir em duas listas de entrada.
  const take = (items: NewsSummary[], count: number) => {
    const picked: NewsSummary[] = [];
    for (const news of items) {
      if (picked.length === count) break;
      if (shown.has(news.id)) continue;
      shown.add(news.id);
      picked.push(news);
    }
    return picked;
  };

  const main = featured?.main ?? latest.items[0];
  if (!main) return <EmptyHome />;
  shown.add(main.id);
  const related = (await getBySlug(main.slug))?.related.slice(0, 3) ?? [];

  const highlights = take(featured?.secondary ?? [], 2);
  const strip = take([...(featured?.secondary ?? []), ...latest.items], 4);
  const feed = take(latest.items, 6);
  const blocks = categoryResults
    .filter((result) => result !== null)
    .map(({ category, page }) => ({ category, items: take(page.items, 4) }))
    .filter((block) => block.items.length > 0);

  return (
    <div className="flex flex-col gap-12">
      <h1 className="sr-only">Zona Sul Urgente: notícias da Zona Sul do Rio de Janeiro</h1>
      <Container>
        <section
          aria-label="Destaques"
          className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
        >
          <NewsCardFeatured news={main} related={related} preload />
          {highlights.length > 0 && (
            <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {highlights.map((news) => (
                <NewsCardOverlay key={news.id} news={news} />
              ))}
            </div>
          )}
        </section>

        {strip.length > 0 && (
          <section
            aria-label="Mais notícias"
            className="mt-8 grid gap-6 border-y py-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {strip.map((news) => (
              <NewsCardCompact key={news.id} news={news} />
            ))}
          </section>
        )}
      </Container>

      <AdSlot slotKey="HOME_TOP" contained />

      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="ultimas">
          <SectionHeader id="ultimas" title="Últimas notícias" />
          <div className="flex flex-col divide-y">
            {feed.map((news) => (
              <NewsCardHorizontal key={news.id} news={news} className="py-5 first:pt-0" />
            ))}
          </div>
        </section>
        <aside className="flex flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
          <MostRead />
          <AdSlot slotKey="HOME_SIDEBAR" />
        </aside>
      </Container>

      {videos.length > 0 && (
        <section aria-labelledby="videos" className="bg-brand-blue-dark py-10">
          <Container>
            <SectionHeader id="videos" title="Vídeos" onDark />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {videos.map((news) => (
                <NewsCardVideo key={news.id} news={news} />
              ))}
            </div>
          </Container>
        </section>
      )}

      <AdSlot slotKey="HOME_MIDDLE" contained />

      {blocks.length > 0 && (
        // Uma coluna por editoria (estilo O Globo): destaque com foto + títulos em lista.
        <Container className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {blocks.map(({ category, items: [lead, ...rest] }) => (
            <section key={category.id} aria-labelledby={`editoria-${category.slug}`}>
              <SectionHeader
                id={`editoria-${category.slug}`}
                title={category.name}
                href={routes.category(category)}
              />
              <NewsCard news={lead} />
              {rest.length > 0 && (
                <ul className="mt-4 flex flex-col divide-y border-t">
                  {rest.map((news) => (
                    <li key={news.id} className="flex items-start gap-2.5 py-3">
                      <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-kicker" />
                      <Link
                        href={routes.news(news)}
                        className="font-heading text-teaser font-bold hover:text-brand-blue"
                      >
                        {news.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </Container>
      )}

      <Container>
        <section aria-labelledby="bairros" className="border-t pt-8">
          <SectionHeader id="bairros" title="Notícias do seu bairro" />
          <ul className="flex flex-wrap gap-2">
            {neighborhoods.map((neighborhood) => (
              <li key={neighborhood.id}>
                <Link
                  href={routes.neighborhood(neighborhood.slug)}
                  className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition hover:-translate-y-px hover:border-brand-blue hover:bg-brand-blue hover:text-white motion-reduce:transition-none"
                >
                  {neighborhood.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </div>
  );
}

function EmptyHome() {
  return (
    <Container className="py-16 text-center">
      <h1 className="text-headline">Nenhuma notícia publicada ainda</h1>
      <p className="mt-2 text-muted-foreground">Volte em instantes.</p>
    </Container>
  );
}
