import Link from "next/link";

import { AdSlot, isAdSlotVisible } from "@/components/ads/ad-slot";
import { SectionHeader } from "@/components/home/section-header";
import { Container } from "@/components/layout/container";
import { MostReadRow } from "@/components/news/most-read";
import {
  NewsCardCompact,
  NewsCardFeatured,
  NewsCardHorizontal,
  NewsCardOverlay,
  NewsCardVideo,
} from "@/components/news/news-card";
import { StoryCard } from "@/components/news/story-card";
import { StoryPlayer } from "@/components/news/story-player";
import { WhatsAppCta } from "@/components/news/whatsapp-cta";
import { CarouselRow } from "@/components/ui/carousel-row";
import { routes } from "@/config/navigation";
import {
  getByCategory,
  getBySlug,
  getFeatured,
  getLatest,
  getVideos,
} from "@/services/news-service";
import { getLatestStories } from "@/services/story-service";
import { getNeighborhoods } from "@/services/taxonomy-service";
import type { NewsSummary } from "@/types/news";

// Home (FE-101), na estrutura da CNN: manchete + destaques, últimas, Mais Lidas em faixa,
// Webstories, vídeos com moldura do site, editorias em colunas coloridas e bairros.
// Uma notícia aparece uma vez só nas seções editoriais (Mais Lidas e Vídeos são rankings
// e formatos próprios, então podem repetir).

const CATEGORY_BLOCKS = ["seguranca", "esportes", "economia"];

export default async function HomePage() {
  const [featured, latest, videos, stories, neighborhoods, hasSidebarAd, ...categoryResults] =
    await Promise.all([
      getFeatured(),
      getLatest({ limit: 30 }),
      getVideos(8),
      getLatestStories(10),
      getNeighborhoods(),
      isAdSlotVisible("HOME_SIDEBAR"),
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
  const feed = take(latest.items, hasSidebarAd ? 6 : 8);
  const blocks = categoryResults
    .filter((result) => result !== null)
    .map(({ category, page }) => {
      // Prefere notícias inéditas; se a editoria tiver pouco conteúdo novo, completa com as
      // já exibidas acima para a coluna não sumir (ex.: Esportes com 2 notícias no dia).
      const fresh = take(page.items, 4);
      const filler = page.items
        .filter((n) => !fresh.includes(n))
        .slice(0, Math.max(0, 3 - fresh.length));
      return { category, items: [...fresh, ...filler] };
    })
    .filter((block) => block.items.length > 0);

  return (
    <div className="flex flex-col gap-14">
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

      <Container
        className={hasSidebarAd ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]" : undefined}
      >
        <section aria-labelledby="ultimas">
          <SectionHeader id="ultimas" title="Últimas notícias" />
          <div
            className={
              hasSidebarAd
                ? "flex flex-col divide-y"
                : "grid gap-x-10 divide-y lg:grid-cols-2 lg:divide-y-0"
            }
          >
            {feed.map((news) => (
              <NewsCardHorizontal key={news.id} news={news} className="py-5 first:pt-0" />
            ))}
          </div>
        </section>
        {hasSidebarAd && (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <AdSlot slotKey="HOME_SIDEBAR" />
          </aside>
        )}
      </Container>

      <Container>
        <MostReadRow className="border-t pt-8" />
      </Container>

      {stories.length > 0 && (
        <Container>
          <StoryPlayer
            stories={stories.map((story) => ({
              url: routes.story(story.slug),
              title: story.title,
            }))}
          >
            <CarouselRow
              label="Webstories"
              header={<SectionHeader id="webstories" title="Webstories" />}
            >
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </CarouselRow>
          </StoryPlayer>
        </Container>
      )}

      {videos.length > 0 && (
        <Container>
          <CarouselRow label="Vídeos" header={<SectionHeader id="videos" title="Vídeos" />}>
            {videos.map((news) => (
              <NewsCardVideo key={news.id} news={news} className="w-64 shrink-0 snap-start" />
            ))}
          </CarouselRow>
        </Container>
      )}

      <WhatsAppCta className="mx-auto w-[calc(100%-2rem)] max-w-site" />

      <AdSlot slotKey="HOME_MIDDLE" contained />

      {blocks.length > 0 && (
        // Uma coluna por editoria (estilo CNN): título na cor da editoria, destaque com o
        // título sobre a foto e lista com miniaturas.
        <Container className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {blocks.map(({ category, items: [lead, ...rest] }) => (
            <section key={category.id} aria-labelledby={`editoria-${category.slug}`}>
              <SectionHeader
                id={`editoria-${category.slug}`}
                title={category.name}
                href={routes.category(category)}
                category={category}
              />
              <NewsCardOverlay news={lead} className="rounded-md" />
              {rest.length > 0 && (
                <div className="mt-4 flex flex-col divide-y border-t">
                  {rest.map((news) => (
                    <NewsCardCompact key={news.id} news={news} className="py-4" />
                  ))}
                </div>
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
