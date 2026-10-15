import { ClockIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";

import { AdSlot } from "@/components/ads/ad-slot";
import { ArticleBody } from "@/components/article/article-body";
import { ArticleFigure, ArticleVideo } from "@/components/article/article-media";
import { Breadcrumbs } from "@/components/article/breadcrumbs";
import { ShareButtons } from "@/components/article/share-buttons";
import { pillButton, ShareMenu } from "@/components/article/share-menu";
import { Container } from "@/components/layout/container";
import { MostReadList } from "@/components/news/most-read";
import { Kicker, SponsoredBadge, UrgentBadge } from "@/components/news/news-badges";
import { NewsCard } from "@/components/news/news-card";
import { GoogleFollowCta, WhatsAppCta } from "@/components/news/whatsapp-cta";
import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { formatShortDateTime } from "@/lib/format";
import { relatedSearches } from "@/lib/related-searches";
import { sectionStyle } from "@/lib/section-color";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  newsArticleJsonLd,
  newsBreadcrumbs,
  serializeJsonLd,
} from "@/lib/structured-data";
import type { News } from "@/types/news";

const listFormat = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });
const siteHost = new URL(siteConfig.url).host;

// Página da matéria (FE-103): coluna de leitura + "Mais lidas" fixo na lateral.
export function ArticleView({ news }: { news: News }) {
  const url = absoluteUrl(routes.news(news));
  const crumbs = newsBreadcrumbs(news);
  const place = news.location?.neighborhood?.name;
  const searches = relatedSearches(news);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(newsArticleJsonLd(news)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }}
      />

      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="min-w-0">
          <div className="mx-auto flex max-w-[46rem] flex-col gap-6">
            <header className="flex flex-col gap-4">
              <Breadcrumbs crumbs={crumbs} />
              <div
                style={sectionStyle(news.category)}
                className="flex flex-wrap items-center gap-2"
              >
                {news.isUrgent && <UrgentBadge />}
                {news.isSponsored && <SponsoredBadge />}
                <Kicker>
                  {news.category.name}
                  {place && <span className="text-muted-foreground"> · {place}</span>}
                </Kicker>
              </div>
              <h1 className="text-display">{news.title}</h1>
              {news.subtitle && <p className="text-title font-normal">{news.subtitle}</p>}

              {/* Crédito e datas no padrão CNN. */}
              <div className="flex flex-col gap-1 text-sm">
                <p>
                  <span className="font-semibold underline decoration-1 underline-offset-2">
                    {listFormat.format(news.authors.map((a) => a.name))}
                  </span>
                  {news.authors.some((a) => a.slug !== "redacao") && (
                    <span>, do {siteConfig.name}</span>
                  )}
                </p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
                  <time dateTime={news.publishedAt}>{formatShortDateTime(news.publishedAt)}</time>
                  {news.updatedAt && (
                    <>
                      <span aria-hidden>|</span>
                      <span>
                        Atualizado{" "}
                        <time dateTime={news.updatedAt}>{formatShortDateTime(news.updatedAt)}</time>
                      </span>
                    </>
                  )}
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon aria-hidden className="size-3.5" />
                    {news.readingTimeMinutes} min de leitura
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ShareMenu url={url} title={news.title} />
                <a
                  href={`https://www.google.com/preferences/source?q=${encodeURIComponent(siteHost)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={pillButton}
                  title="Mostrar o Zona Sul Urgente com prioridade nas notícias do Google"
                >
                  <PlusIcon className="size-4" aria-hidden />
                  Adicionar {siteConfig.name} ao Google
                </a>
              </div>
            </header>

            {news.sponsor && (
              <aside className="border-l-4 border-brand-sky bg-sponsored p-4 text-sm text-sponsored-foreground">
                <strong>Conteúdo patrocinado</strong> por{" "}
                {news.sponsor.url ? (
                  <a
                    href={news.sponsor.url}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="underline"
                  >
                    {news.sponsor.name}
                  </a>
                ) : (
                  news.sponsor.name
                )}
                . Produzido com identificação publicitária, conforme a política editorial.
              </aside>
            )}

            {/* Vídeo próprio substitui a foto (com ela de capa); Instagram vira link abaixo da foto. */}
            {news.video?.provider === "r2" || news.video?.provider === "youtube" ? (
              <ArticleVideo video={news.video} fallbackPoster={news.image} />
            ) : (
              <>
                {news.image && <ArticleFigure image={news.image} preload />}
                {news.video && <ArticleVideo video={news.video} />}
              </>
            )}

            <AdSlot slotKey="ARTICLE_TOP" />

            <ArticleBody blocks={news.body} />

            <WhatsAppCta category={news.category} />

            <div className="flex flex-col gap-3 border-t pt-5">
              <p className="font-semibold">Compartilhe esta notícia</p>
              <ShareButtons url={url} title={news.title} />
            </div>

            <AdSlot slotKey="ARTICLE_BOTTOM" />

            <GoogleFollowCta />

            {news.tags.length > 0 && (
              <section aria-labelledby="topicos" className="flex flex-col gap-3">
                <h2 id="topicos" className="font-heading text-title font-bold text-brand-red">
                  Tópicos
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {news.tags.map((tag) => (
                    <li key={tag.id}>
                      <Link
                        href={`${routes.search}?q=${encodeURIComponent(tag.name)}`}
                        className="inline-flex rounded-md border px-4 py-2 text-sm text-muted-foreground transition hover:border-brand-blue hover:text-brand-blue"
                      >
                        {tag.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid gap-8 border-t pt-6 md:grid-cols-[minmax(0,1fr)_14rem]">
              {news.related.length > 0 && (
                <section aria-labelledby="relacionadas">
                  <h2
                    id="relacionadas"
                    className="mb-4 text-label font-bold tracking-wide uppercase"
                  >
                    Notícias relacionadas
                  </h2>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {news.related.map((item) => (
                      <NewsCard key={item.id} news={item} />
                    ))}
                  </div>
                </section>
              )}
              {searches.length > 0 && (
                <section aria-labelledby="pesquisas">
                  <h2 id="pesquisas" className="mb-4 text-label font-bold tracking-wide uppercase">
                    Pesquisas relacionadas
                  </h2>
                  <ul className="flex flex-col gap-2.5">
                    {searches.map((term) => (
                      <li key={term}>
                        <Link
                          href={`${routes.search}?q=${encodeURIComponent(term)}`}
                          className="flex items-center justify-between gap-3 rounded-full border px-4 py-2.5 text-sm transition hover:border-brand-blue hover:text-brand-blue"
                        >
                          <span className="truncate">{term}</span>
                          <SearchIcon aria-hidden className="size-4 shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </article>

        <aside className="flex flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
          <MostReadList />
        </aside>
      </Container>
    </>
  );
}
