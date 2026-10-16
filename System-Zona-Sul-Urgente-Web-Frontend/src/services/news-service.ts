import { routes } from "@/config/navigation";
import { featuredRank, MOCK_NOW, newsMock, toSummary, viewsBySlug } from "@/mocks/news";
import { categories, city, neighborhoods } from "@/mocks/taxonomy";
import { apiBaseUrl, unwrap } from "@/services/api/client";
import * as api from "@/services/api/public-api";
import { ServiceError } from "@/services/errors";
import type {
  BreakingNews,
  Category,
  City,
  MostReadPeriod,
  Neighborhood,
  News,
  NewsSummary,
  Page,
  PageRequest,
  SearchRequest,
} from "@/types/news";

// Camada de dados de notícias (FE-010). Componentes e páginas usam SÓ estas funções.
// Com API_URL configurada, cada função chama /api/v1/public/** (src/services/api, com
// `use cache` + cacheTag); sem ela, usa os dados de exemplo (src/mocks). Assinaturas iguais.

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;
/** Urgentes saem da faixa depois deste tempo. */
const BREAKING_WINDOW_HOURS = 6;

export type HomeFeatured = {
  /** Manchete principal. */
  main: NewsSummary;
  /** Destaques secundários, em ordem editorial. */
  secondary: NewsSummary[];
};

export async function getBreakingNews(): Promise<BreakingNews[]> {
  if (apiBaseUrl()) return api.breaking();
  const since = MOCK_NOW.getTime() - BREAKING_WINDOW_HOURS * 3_600_000;
  return newsMock
    .filter((n) => n.isUrgent && Date.parse(n.publishedAt) >= since)
    .map(({ id, slug, title, category, publishedAt }) => ({
      id,
      slug,
      title,
      category,
      publishedAt,
    }));
}

export async function getFeatured(): Promise<HomeFeatured | null> {
  if (apiBaseUrl()) return api.featured();
  const ranked = newsMock
    .filter((n) => featuredRank.has(n.slug))
    .sort((a, b) => featuredRank.get(a.slug)! - featuredRank.get(b.slug)!)
    .map(toSummary);
  if (ranked.length === 0) return null;
  const [main, ...secondary] = ranked;
  return { main, secondary };
}

export async function getLatest(request: PageRequest = {}): Promise<Page<NewsSummary>> {
  if (apiBaseUrl())
    return orEmpty(unwrap(await api.latest(request.cursor, clampLimit(request.limit))));
  return paginate(newsMock.map(toSummary), request);
}

/** Notícias com vídeo, das mais recentes (faixa de vídeos da home). */
export async function getVideos(limit = 4): Promise<NewsSummary[]> {
  if (apiBaseUrl()) return api.videos(clampLimit(limit));
  return newsMock
    .filter((n) => n.hasVideo)
    .slice(0, clampLimit(limit))
    .map(toSummary);
}

/** Matéria completa. `null` = não existe ou não está publicada → página chama notFound(). */
export async function getBySlug(slug: string): Promise<News | null> {
  if (apiBaseUrl()) return api.bySlug(slug);
  return newsMock.find((n) => n.slug === slug) ?? null;
}

export async function getByCategory(
  slug: string,
  request: PageRequest = {},
): Promise<{ category: Category; page: Page<NewsSummary> } | null> {
  if (apiBaseUrl())
    return unwrap(await api.byCategory(slug, request.cursor, clampLimit(request.limit)));
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;
  // Editoria mãe inclui as subeditorias (Entretenimento traz Gastronomia e Eventos).
  const items = newsMock
    .filter((n) => n.category.slug === slug || n.category.parent?.slug === slug)
    .map(toSummary);
  return { category, page: paginate(items, request) };
}

/** Colunas (Blogs e colunas) com o post mais recente de cada uma, da mais nova para a mais antiga. */
export async function getLatestColumns(
  limit = 10,
): Promise<{ column: Category; latest: NewsSummary }[]> {
  if (apiBaseUrl()) return api.latestColumns(clampLimit(limit));
  // newsMock já vem do mais recente para o mais antigo: o primeiro de cada coluna é o último post.
  return categories
    .filter((c) => c.columnist)
    .flatMap((column) => {
      const latest = newsMock.find((n) => n.category.slug === column.slug);
      return latest ? [{ column, latest: toSummary(latest) }] : [];
    })
    .sort((a, b) => b.latest.publishedAt.localeCompare(a.latest.publishedAt))
    .slice(0, clampLimit(limit));
}

export async function getByNeighborhood(
  slug: string,
  request: PageRequest = {},
): Promise<{ neighborhood: Neighborhood; page: Page<NewsSummary> } | null> {
  if (apiBaseUrl())
    return unwrap(await api.byNeighborhood(slug, request.cursor, clampLimit(request.limit)));
  const neighborhood = neighborhoods.find((n) => n.slug === slug);
  if (!neighborhood) return null;
  const items = newsMock.filter((n) => n.location?.neighborhood?.slug === slug).map(toSummary);
  return { neighborhood, page: paginate(items, request) };
}

export async function getByCity(
  slug: string,
  request: PageRequest = {},
): Promise<{ city: City; page: Page<NewsSummary> } | null> {
  if (apiBaseUrl())
    return unwrap(await api.byCity(slug, request.cursor, clampLimit(request.limit)));
  if (slug !== city.slug) return null;
  const items = newsMock.filter((n) => n.location?.city.slug === slug).map(toSummary);
  return { city, page: paginate(items, request) };
}

export async function getMostRead(
  period: MostReadPeriod = "24h",
  limit = 5,
): Promise<NewsSummary[]> {
  if (apiBaseUrl()) return api.mostRead(period, clampLimit(limit));
  const key = period === "24h" ? "day" : period === "7d" ? "week" : "total";
  return (
    newsMock
      // Patrocinadas não entram no ranking editorial.
      .filter((n) => !n.isSponsored)
      .map((n) => ({ news: n, views: viewsBySlug.get(n.slug)?.[key] ?? 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, clampLimit(limit))
      .map(({ news }) => toSummary(news))
  );
}

/** Busca textual sem diferenciar acentos/maiúsculas; todos os termos precisam aparecer. */
export async function search(request: SearchRequest): Promise<Page<NewsSummary>> {
  const terms = normalize(request.query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { items: [], nextCursor: null };
  if (apiBaseUrl()) {
    const page = await api.search(
      request.query.trim(),
      request.categorySlug,
      request.neighborhoodSlug,
      request.cursor,
      clampLimit(request.limit),
    );
    return orEmpty(unwrap(page));
  }

  const items = newsMock
    // Editoria mãe inclui as subeditorias (filtrar "Entretenimento" traz Gastronomia).
    .filter(
      (n) =>
        !request.categorySlug ||
        n.category.slug === request.categorySlug ||
        n.category.parent?.slug === request.categorySlug,
    )
    .filter(
      (n) =>
        !request.neighborhoodSlug || n.location?.neighborhood?.slug === request.neighborhoodSlug,
    )
    .filter((n) => {
      const haystack = normalize(
        [
          n.title,
          n.subtitle,
          n.summary,
          n.category.name,
          n.location?.neighborhood?.name,
          ...n.tags.map((t) => t.name),
        ].join(" "),
      );
      return terms.every((term) => haystack.includes(term));
    })
    .map(toSummary);

  return paginate(items, request);
}

export type ResolvedPath =
  | { type: "category"; category: Category }
  /** Endereço antigo (editoria/notícia mudou de endereço): a página responde 308. */
  | { type: "redirect"; location: string }
  | {
      type: "news";
      news: News;
      /** URL correta; difere quando a editoria mudou. */ canonicalPath: string;
    };

/**
 * Traduz os segmentos de URL na raiz (/{editoria}, /{editoria}/{sub}, /{editoria}/{slug},
 * /{editoria}/{sub}/{slug}) em editoria ou matéria. `null` = 404.
 * Se a matéria existir mas a editoria da URL estiver desatualizada, a página redireciona (301)
 * para `canonicalPath` — assim mudar a editoria de uma notícia não quebra links antigos.
 */
export async function resolveSectionPath(segments: string[]): Promise<ResolvedPath | null> {
  if (segments.length === 0 || segments.length > 3) return null;
  if (apiBaseUrl()) {
    // Caminho fora do padrão de slug nem chega à API (ela recusaria com 400).
    if (!segments.every((s) => /^[a-z0-9-]+$/.test(s))) return null;
    return api.resolve(segments.join("/"));
  }
  const [first, second, third] = segments;
  const root = categories.find((c) => c.slug === first && !c.parent);
  if (!root) return null;

  if (segments.length === 1) return { type: "category", category: root };

  const sub = categories.find((c) => c.slug === second && c.parent?.slug === root.slug);
  if (segments.length === 2 && sub) return { type: "category", category: sub };

  const newsSlug = segments.length === 2 ? second : sub ? third : undefined;
  if (!newsSlug) return null;
  const news = await getBySlug(newsSlug);
  if (!news) return null;
  return { type: "news", news, canonicalPath: routes.news(news) };
}

/**
 * Matérias para RSS: as mais recentes, sem patrocinadas (agregadores republicam sem o selo).
 * Com `categorySlug`, só a editoria (incluindo subeditorias). `null` = editoria inexistente.
 */
export async function getNewsForFeed(categorySlug?: string, limit = 30): Promise<News[] | null> {
  if (apiBaseUrl()) return api.feed(categorySlug, clampLimit(limit));
  if (categorySlug && !categories.some((c) => c.slug === categorySlug)) return null;
  return newsMock
    .filter((n) => !n.isSponsored)
    .filter(
      (n) =>
        !categorySlug ||
        n.category.slug === categorySlug ||
        n.category.parent?.slug === categorySlug,
    )
    .slice(0, clampLimit(limit));
}

export type SitemapNews = Pick<
  NewsSummary,
  "slug" | "title" | "category" | "publishedAt" | "updatedAt" | "image"
>;

/** Todas as matérias publicadas, para o sitemap geral (BE: endpoint paginado/streaming). */
export async function getNewsForSitemap(): Promise<SitemapNews[]> {
  if (apiBaseUrl()) return (await api.sitemap(undefined)).map(toSitemap);
  return newsMock.map(({ slug, title, category, publishedAt, updatedAt, image }) => ({
    slug,
    title,
    category,
    publishedAt,
    updatedAt,
    image,
  }));
}

/**
 * Matérias das últimas 48 h para o sitemap do Google Notícias (regra do Google: só as
 * publicadas nos últimos 2 dias, no máximo 1.000). Patrocinadas ficam de fora.
 */
export async function getNewsForNewsSitemap(): Promise<SitemapNews[]> {
  if (apiBaseUrl()) return (await api.sitemap(48)).map(toSitemap);
  const since = MOCK_NOW.getTime() - 48 * 3_600_000;
  return (await getNewsForSitemap())
    .filter((n) => Date.parse(n.publishedAt) >= since)
    .filter((n) => !newsMock.find((m) => m.slug === n.slug)?.isSponsored)
    .slice(0, 1000);
}

/** Todos os caminhos conhecidos (editorias e matérias) para pré-gerar no build. */
export async function getSectionPaths(): Promise<string[][]> {
  if (apiBaseUrl()) {
    const [cats, news] = await Promise.all([api.categories(), api.sitemap(undefined)]);
    return [
      ...cats.map((c) => (c.parent ? [c.parent.slug, c.slug] : [c.slug])),
      ...news.map((n) => routes.news(n).split("/").filter(Boolean)),
    ];
  }
  const categoryPaths = categories.map((c) => (c.parent ? [c.parent.slug, c.slug] : [c.slug]));
  const newsPaths = newsMock.map((n) => routes.news(n).split("/").filter(Boolean));
  return [...categoryPaths, ...newsPaths];
}

// ---------------------------------------------------------------- utilitários

const toSitemap = ({ slug, title, category, publishedAt, updatedAt, image }: NewsSummary) => ({
  slug,
  title,
  category,
  publishedAt,
  updatedAt,
  image,
});

const orEmpty = (page: Page<NewsSummary> | null): Page<NewsSummary> =>
  page ?? { items: [], nextCursor: null, total: 0 };

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}

/** Cursor opaco: os componentes nunca devem interpretar o conteúdo. */
function paginate<T>(items: T[], { cursor, limit }: PageRequest): Page<T> {
  const size = clampLimit(limit);
  const offset = cursor ? decodeCursor(cursor) : 0;
  const next = offset + size;
  return {
    items: items.slice(offset, next),
    nextCursor: next < items.length ? encodeCursor(next) : null,
    total: items.length,
  };
}

function encodeCursor(offset: number): string {
  return Buffer.from(`o:${offset}`).toString("base64url");
}

function decodeCursor(cursor: string): number {
  const match = /^o:(\d+)$/.exec(Buffer.from(cursor, "base64url").toString());
  if (!match) throw new ServiceError("Cursor de paginação inválido.", "BAD_REQUEST");
  return Number(match[1]);
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
