// Modelo de domínio do portal (FE-008). Representa o contrato REST de /api/v1/public/**:
// quando o CT-002 gerar os tipos a partir do OpenAPI, estes viram aliases dos gerados.
// Convenções: IDs são UUIDv7 em string; datas em ISO 8601 com fuso; campos opcionais
// usam `?` (ausente) e nunca `null`, exceto quando "vazio" tem significado próprio.

export type UUID = string;
export type ISODateTime = string;

// ---------------------------------------------------------------- taxonomia

export type CategoryRef = Pick<Category, "id" | "slug" | "name">;

/**
 * Editoria. URL na raiz, como CNN/g1: /{slug} ou /{mae}/{slug} quando tem editoria mãe
 * (ex.: /entretenimento/gastronomia). Um nível de hierarquia só.
 */
export type Category = {
  id: UUID;
  slug: string;
  name: string;
  description?: string;
  parent?: CategoryRef;
  /** Canal de WhatsApp da editoria ("Acompanhe Esportes no WhatsApp"). Subeditoria herda da mãe. */
  whatsappUrl?: string;
  /** Quando a subeditoria é uma coluna (Blogs e colunas): quem assina. */
  columnist?: Columnist;
};

/** Colunista dono de uma coluna (subeditoria de "colunas"). */
export type Columnist = {
  authorSlug: string;
  name: string;
  /** Uma linha: especialidade ("Urbanismo e vida nos bairros"). */
  bio: string;
  photo?: MediaAsset;
};

export type Tag = {
  id: UUID;
  slug: string;
  name: string;
};

export type Author = {
  id: UUID;
  slug: string;
  name: string;
  /** Cargo exibido no crédito: "Repórter", "Editora", "Colunista"... */
  role: string;
  avatar?: MediaAsset;
  bio?: string;
};

// ---------------------------------------------------------------- localização

export type City = {
  id: UUID;
  slug: string;
  name: string;
  /** Sigla da UF, ex.: "RJ". */
  state: string;
};

/** Zona da cidade (Zona Sul, Zona Norte, Zona Oeste...). O portal começa só na Zona Sul. */
export type Zone = {
  id: UUID;
  slug: string;
  name: string;
};

export type Neighborhood = {
  id: UUID;
  slug: string;
  name: string;
  citySlug: string;
  zone: Zone;
};

export type NewsLocation = {
  city: City;
  neighborhood?: Neighborhood;
};

// ---------------------------------------------------------------- mídia

export type MediaAsset = {
  id: UUID;
  /** URL do original no R2 (o loader escolhe o derivado pela largura). */
  url: string;
  width: number;
  height: number;
  /** Obrigatório: descreve a imagem para quem não a vê. */
  alt: string;
  caption?: string;
  credit?: string;
};

export type VideoEmbed = {
  provider: "instagram" | "youtube" | "r2";
  url: string;
  poster?: MediaAsset;
  durationSeconds?: number;
};

// ---------------------------------------------------------------- notícia

/** Ciclo editorial. Na API pública só aparece PUBLISHED. */
export type NewsStatus =
  "DRAFT" | "IN_REVIEW" | "SCHEDULED" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";

export type NewsOrigin = "MANUAL" | "INSTAGRAM";

/**
 * Corpo em blocos estruturados (não HTML livre). `html` dos parágrafos vem sanitizado
 * pela API, com allowlist de <a>, <strong>, <em>; o frontend sanitiza de novo ao renderizar.
 */
export type ArticleBlock =
  | { type: "paragraph"; html: string }
  | { type: "heading"; text: string }
  | { type: "quote"; text: string; source?: string }
  | { type: "image"; image: MediaAsset }
  | { type: "video"; video: VideoEmbed }
  | { type: "list"; ordered: boolean; items: string[] };

export type Sponsor = {
  name: string;
  url?: string;
};

export type NewsSeo = {
  title?: string;
  description?: string;
  /** Quando ausente, a canonical é a URL da própria notícia. */
  canonicalUrl?: string;
};

/** Versão resumida, usada em cards, listas e feeds. */
export type NewsSummary = {
  id: UUID;
  slug: string;
  title: string;
  subtitle?: string;
  summary: string;
  category: Category;
  location?: NewsLocation;
  image?: MediaAsset;
  hasVideo: boolean;
  isUrgent: boolean;
  /** Matéria paga: exige o selo "Patrocinado" em qualquer listagem. */
  isSponsored: boolean;
  publishedAt: ISODateTime;
  updatedAt?: ISODateTime;
};

/** Matéria completa (GET /api/v1/public/news/{slug}). */
export type News = NewsSummary & {
  authors: Author[];
  tags: Tag[];
  body: ArticleBlock[];
  video?: VideoEmbed;
  sponsor?: Sponsor;
  readingTimeMinutes: number;
  origin: NewsOrigin;
  seo?: NewsSeo;
  /** Notícias relacionadas já resolvidas pela API (até 4). */
  related: NewsSummary[];
};

/** Item da faixa de urgentes (a editoria entra para montar a URL /{editoria}/{slug}). */
export type BreakingNews = Pick<NewsSummary, "id" | "slug" | "title" | "category" | "publishedAt">;

// ---------------------------------------------------------------- listagens

/** Paginação por cursor (estável para "carregar mais", BE-004). */
export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  /** Total de itens que atendem ao filtro (a busca mostra "N resultados"). */
  total?: number;
};

export type PageRequest = {
  cursor?: string | null;
  /** Padrão 12, máximo 50. */
  limit?: number;
};

export type MostReadPeriod = "24h" | "7d" | "all";

export type SearchRequest = PageRequest & {
  query: string;
  categorySlug?: string;
  neighborhoodSlug?: string;
};

// ---------------------------------------------------------------- publicidade

export type AdSlotKey =
  | "HOME_TOP"
  | "HOME_MIDDLE"
  | "HOME_SIDEBAR"
  | "ARTICLE_TOP"
  | "ARTICLE_MIDDLE"
  | "ARTICLE_BOTTOM"
  | "CATEGORY_TOP"
  | "MOBILE_STICKY";

export type AdSize = { width: number; height: number };

export type AdSlot = {
  key: AdSlotKey;
  /** Tamanhos aceitos; o primeiro reserva o espaço e evita CLS. */
  sizes: AdSize[];
  label: string;
};

export type Advertisement =
  | {
      id: UUID;
      slot: AdSlotKey;
      type: "DIRECT";
      advertiser: string;
      image: MediaAsset;
      clickUrl: string;
      startsAt: ISODateTime;
      endsAt: ISODateTime;
    }
  | {
      id: UUID;
      slot: AdSlotKey;
      type: "ADSENSE";
      adUnitId: string;
    };

// ---------------------------------------------------------------- web stories

export type WebStoryPage = {
  /** Foto vertical (9:16 ou 3:4) que preenche a tela. */
  image: MediaAsset;
  /** Texto curto sobre a foto (até ~140 caracteres). */
  text: string;
};

/**
 * Web Story no formato AMP Story (o que o Google Discover exibe). Publicada em /stories/{slug};
 * a última página leva para a matéria completa.
 */
export type WebStory = {
  id: UUID;
  slug: string;
  title: string;
  category: Category;
  /** Capa retrato 3:4 (mínimo 640×853, exigência do formato). */
  cover: MediaAsset;
  pages: WebStoryPage[];
  /** Matéria relacionada (link "Leia mais" no fim da story). */
  news?: Pick<NewsSummary, "slug" | "title" | "category">;
  publishedAt: ISODateTime;
};
