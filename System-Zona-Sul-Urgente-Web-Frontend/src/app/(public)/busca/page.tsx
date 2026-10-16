import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import { RemoteImage } from "@/components/media/remote-image";
import Link from "next/link";
import { Suspense } from "react";

import { Container } from "@/components/layout/container";
import { Kicker, SponsoredBadge, UrgentBadge } from "@/components/news/news-badges";
import { RelativeTime } from "@/components/news/relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/navigation";
import { highlight } from "@/lib/highlight";
import { sectionStyle } from "@/lib/section-color";
import { ServiceError } from "@/services/errors";
import { search } from "@/services/news-service";
import { getCategories, getNeighborhoods, getPopularTags } from "@/services/taxonomy-service";
import type { NewsSummary, Page } from "@/types/news";

export const metadata: Metadata = {
  title: "Busca",
  // Resultados de busca não devem ser indexados (conteúdo duplicado/infinito).
  robots: { index: false, follow: true },
};

const MAX_QUERY = 120;
const PAGE_SIZE = 10;

// Busca (FE-106). A URL guarda termo, filtros e página: recarregar ou compartilhar mantém
// a busca. Formulário GET, sem JavaScript. Resultados em <Suspense> (lêem searchParams).
export default function SearchPage({ searchParams }: PageProps<"/busca">) {
  return (
    <Container>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <h1 className="text-headline">Buscar notícias</h1>
        <Suspense fallback={<ResultsSkeleton />}>
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

type Params = Awaited<PageProps<"/busca">["searchParams"]>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

async function SearchResults({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = first(params.q).slice(0, MAX_QUERY);
  const categorySlug = first(params.editoria) || undefined;
  const neighborhoodSlug = first(params.bairro) || undefined;
  const cursor = first(params.cursor) || null;

  const [categories, neighborhoods, popularTags] = await Promise.all([
    getCategories(),
    getNeighborhoods(),
    getPopularTags(),
  ]);

  let page: Page<NewsSummary> = { items: [], nextCursor: null, total: 0 };
  if (query) {
    try {
      page = await search({ query, categorySlug, neighborhoodSlug, cursor, limit: PAGE_SIZE });
    } catch (error) {
      // Cursor inválido (URL editada à mão): volta para a primeira página.
      if (!(error instanceof ServiceError && error.code === "BAD_REQUEST")) throw error;
      page = await search({ query, categorySlug, neighborhoodSlug, limit: PAGE_SIZE });
    }
  }

  const nextHref = page.nextCursor
    ? `${routes.search}?${new URLSearchParams({
        q: query,
        ...(categorySlug && { editoria: categorySlug }),
        ...(neighborhoodSlug && { bairro: neighborhoodSlug }),
        cursor: page.nextCursor,
      })}`
    : null;

  const roots = categories.filter((c) => !c.parent);
  const field =
    "h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

  return (
    <>
      <form action={routes.search} method="get" role="search" className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label htmlFor="busca-q" className="sr-only">
            Termo da busca
          </label>
          <input
            id="busca-q"
            name="q"
            type="search"
            required
            maxLength={MAX_QUERY}
            defaultValue={query}
            autoFocus={!query}
            placeholder="Ex.: chuva Copacabana, Túnel Rebouças, feira"
            className={`${field} min-w-0 flex-1 text-base`}
          />
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-brand-blue-dark"
          >
            <SearchIcon aria-hidden className="size-4" />
            Buscar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="busca-editoria">
            Editoria
          </label>
          <select
            id="busca-editoria"
            name="editoria"
            defaultValue={categorySlug ?? ""}
            className={field}
          >
            <option value="">Todas as editorias</option>
            {roots.map((root) => (
              <optgroup key={root.id} label={root.name}>
                <option value={root.slug}>{root.name} (todas)</option>
                {categories
                  .filter((c) => c.parent?.slug === root.slug)
                  .map((sub) => (
                    <option key={sub.id} value={sub.slug}>
                      {sub.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <label className="sr-only" htmlFor="busca-bairro">
            Bairro
          </label>
          <select
            id="busca-bairro"
            name="bairro"
            defaultValue={neighborhoodSlug ?? ""}
            className={field}
          >
            <option value="">Todos os bairros</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.slug}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
      </form>

      {query && (
        <p aria-live="polite" className="border-b pb-3 text-sm text-muted-foreground">
          {page.total === 1 ? "1 resultado" : `${page.total ?? page.items.length} resultados`} para{" "}
          <strong className="text-foreground">“{query}”</strong>
        </p>
      )}

      {page.items.length > 0 ? (
        <ol className="flex flex-col divide-y">
          {page.items.map((news) => (
            <li key={news.id}>
              <SearchResult news={news} query={query} />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          query={query}
          tags={popularTags.map((t) => t.name)}
          neighborhoods={neighborhoods.slice(0, 10)}
        />
      )}

      {(nextHref || cursor) && (
        <nav aria-label="Paginação da busca" className="flex justify-between gap-4 border-t pt-4">
          {cursor ? (
            <Link
              href={`${routes.search}?${new URLSearchParams({
                q: query,
                ...(categorySlug && { editoria: categorySlug }),
                ...(neighborhoodSlug && { bairro: neighborhoodSlug }),
              })}`}
              className="text-sm font-semibold text-brand-blue hover:underline"
            >
              ← Primeiros resultados
            </Link>
          ) : (
            <span />
          )}
          {nextHref && (
            <Link href={nextHref} className="text-sm font-semibold text-brand-blue hover:underline">
              Próximos resultados →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function SearchResult({ news, query }: { news: NewsSummary; query: string }) {
  const place = news.location?.neighborhood?.name;
  return (
    <article className="group relative flex gap-4 py-5">
      <div className="relative aspect-video w-28 shrink-0 self-start overflow-hidden bg-muted sm:w-44">
        {news.image && (
          <RemoteImage
            src={news.image.url}
            alt={news.image.alt}
            fill
            sizes="176px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div style={sectionStyle(news.category)} className="flex flex-wrap items-center gap-2">
          {news.isUrgent && <UrgentBadge />}
          {news.isSponsored ? (
            <SponsoredBadge />
          ) : (
            <Kicker>
              {news.category.name}
              {place && <span className="text-muted-foreground"> · {place}</span>}
            </Kicker>
          )}
        </div>
        <h2 className="font-heading text-teaser font-bold sm:text-title">
          <Link
            href={routes.news(news)}
            className="group-hover:text-brand-blue after:absolute after:inset-0"
          >
            {highlight(news.title, query)}
          </Link>
        </h2>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {highlight(news.summary, query)}
        </p>
        <RelativeTime iso={news.publishedAt} className="text-xs text-muted-foreground" />
      </div>
    </article>
  );
}

function EmptyState({
  query,
  tags,
  neighborhoods,
}: {
  query: string;
  tags: string[];
  neighborhoods: { id: string; slug: string; name: string }[];
}) {
  const chip =
    "inline-flex rounded-full border px-4 py-2 text-sm transition hover:border-brand-blue hover:text-brand-blue";
  return (
    <div className="flex flex-col gap-6 py-6">
      {query && (
        <div>
          <p className="font-semibold">Nenhuma notícia encontrada para “{query}”.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Confira a grafia, use menos palavras ou tire os filtros de editoria e bairro.
          </p>
        </div>
      )}
      <section aria-labelledby="sugestoes-topicos" className="flex flex-col gap-3">
        <h2 id="sugestoes-topicos" className="text-label font-bold tracking-wide uppercase">
          Assuntos em alta
        </h2>
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <Link href={`${routes.search}?q=${encodeURIComponent(tag)}`} className={chip}>
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="sugestoes-bairros" className="flex flex-col gap-3">
        <h2 id="sugestoes-bairros" className="text-label font-bold tracking-wide uppercase">
          Notícias por bairro
        </h2>
        <ul className="flex flex-wrap gap-2">
          {neighborhoods.map((n) => (
            <li key={n.id}>
              <Link href={routes.neighborhood(n.slug)} className={chip}>
                {n.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando resultados" className="flex flex-col gap-4">
      <Skeleton className="h-11 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-48" />
        <Skeleton className="h-11 w-40" />
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex gap-4 py-3">
          <Skeleton className="aspect-video w-28 rounded-none sm:w-44" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
