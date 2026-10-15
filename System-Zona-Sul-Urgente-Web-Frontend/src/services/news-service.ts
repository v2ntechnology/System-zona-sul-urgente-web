import { routes } from "@/config/navigation";
import { featuredRank, MOCK_NOW, newsMock, toSummary, viewsBySlug } from "@/mocks/news";
import { categories, city, neighborhoods } from "@/mocks/taxonomy";
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
// Hoje leem os mocks; quando a API existir (BE-004), cada função passa a chamar
// /api/v1/public/** com `use cache` + cacheTag (src/lib/cache-tags.ts), sem mudar a assinatura.

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
  const ranked = newsMock
    .filter((n) => featuredRank.has(n.slug))
    .sort((a, b) => featuredRank.get(a.slug)! - featuredRank.get(b.slug)!)
    .map(toSummary);
  if (ranked.length === 0) return null;
  const [main, ...secondary] = ranked;
  return { main, secondary };
}

export async function getLatest(request: PageRequest = {}): Promise<Page<NewsSummary>> {
  return paginate(newsMock.map(toSummary), request);
}

/** Notícias com vídeo, das mais recentes (faixa de vídeos da home). */
export async function getVideos(limit = 4): Promise<NewsSummary[]> {
  return newsMock
    .filter((n) => n.hasVideo)
    .slice(0, clampLimit(limit))
    .map(toSummary);
}

/** Matéria completa. `null` = não existe ou não está publicada → página chama notFound(). */
export async function getBySlug(slug: string): Promise<News | null> {
  return newsMock.find((n) => n.slug === slug) ?? null;
}

export async function getByCategory(
  slug: string,
  request: PageRequest = {},
): Promise<{ category: Category; page: Page<NewsSummary> } | null> {
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;
  // Editoria mãe inclui as subeditorias (Entretenimento traz Gastronomia e Eventos).
  const items = newsMock
    .filter((n) => n.category.slug === slug || n.category.parent?.slug === slug)
    .map(toSummary);
  return { category, page: paginate(items, request) };
}

export async function getByNeighborhood(
  slug: string,
  request: PageRequest = {},
): Promise<{ neighborhood: Neighborhood; page: Page<NewsSummary> } | null> {
  const neighborhood = neighborhoods.find((n) => n.slug === slug);
  if (!neighborhood) return null;
  const items = newsMock.filter((n) => n.location?.neighborhood?.slug === slug).map(toSummary);
  return { neighborhood, page: paginate(items, request) };
}

export async function getByCity(
  slug: string,
  request: PageRequest = {},
): Promise<{ city: City; page: Page<NewsSummary> } | null> {
  if (slug !== city.slug) return null;
  const items = newsMock.filter((n) => n.location?.city.slug === slug).map(toSummary);
  return { city, page: paginate(items, request) };
}

export async function getMostRead(
  period: MostReadPeriod = "24h",
  limit = 5,
): Promise<NewsSummary[]> {
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

/** Todos os caminhos conhecidos (editorias e matérias) para pré-gerar no build. */
export async function getSectionPaths(): Promise<string[][]> {
  const categoryPaths = categories.map((c) => (c.parent ? [c.parent.slug, c.slug] : [c.slug]));
  const newsPaths = newsMock.map((n) => routes.news(n).split("/").filter(Boolean));
  return [...categoryPaths, ...newsPaths];
}

// ---------------------------------------------------------------- utilitários

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
