import type {
  ArticleBlock,
  CategoryRef,
  ISODateTime,
  NewsOrigin,
  NewsStatus,
  UUID,
} from "@/types/news";

// Tipos do painel administrativo (contrato de /api/v1/admin/**).

/** Perfis da ARCHITECTURE §8. */
export type Role = "ADMIN" | "EDITOR" | "REPORTER" | "COMERCIAL" | "AUTOR";

/** Permissões checadas pela API; o frontend só esconde o que o perfil não pode usar. */
export type Permission =
  | "news.create"
  | "news.edit.own"
  | "news.edit.any"
  | "news.publish"
  | "news.delete"
  | "news.mark_urgent"
  | "news.mark_sponsored"
  | "instagram.review"
  | "instagram.settings"
  | "taxonomy.manage"
  | "tags.manage"
  | "ads.manage"
  | "analytics.view"
  | "analytics.ads.view"
  | "users.manage"
  | "settings.manage"
  | "audit.view";

export type AdminUser = {
  id: UUID;
  name: string;
  email: string;
  role: Role;
  /** Autor vinculado (para a regra "próprias"). */
  authorSlug?: string;
};

/** Linha da listagem administrativa de notícias. */
export type AdminNewsRow = {
  id: UUID;
  slug: string;
  title: string;
  status: NewsStatus;
  category: CategoryRef & { parent?: CategoryRef };
  authors: string[];
  origin: NewsOrigin;
  isUrgent: boolean;
  isSponsored: boolean;
  updatedAt: ISODateTime;
  publishedAt?: ISODateTime;
  scheduledFor?: ISODateTime;
  /** Exclusão lógica (pode ser restaurada). */
  deletedAt?: ISODateTime;
  views: number;
};

export type AdminNewsFilter = {
  query?: string;
  /** "DELETED" lista a lixeira (exclusão lógica). */
  status?: NewsStatus | "DELETED";
  categorySlug?: string;
  origin?: NewsOrigin;
  /** Página 1-based (listagens do admin usam paginação numérica). */
  page?: number;
  pageSize?: number;
};

export type AdminPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
};

export type InstagramImportStatus =
  "NEW" | "IMPORTED" | "CHANGED_AT_SOURCE" | "ERROR" | "IGNORED" | "REMOVED_AT_SOURCE";

export type InstagramMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

/** Post do Instagram na fila de importação (FE-155) — GET /api/v1/admin/instagram/posts. */
export type InstagramPost = {
  /** ID do post no Instagram (deduplicação). */
  id: string;
  /** Legenda como foi importada (imutável, auditoria). */
  caption: string;
  /** Legenda atual na origem, quando mudou depois da importação (CHANGED_AT_SOURCE). */
  currentCaption?: string;
  permalink: string;
  mediaType: InstagramMediaType;
  /** Quantidade de mídias (carrossel). */
  mediaCount: number;
  thumbnailUrl?: string;
  postedAt: ISODateTime;
  status: InstagramImportStatus;
  /** Notícia gerada a partir do post. */
  news?: {
    id: UUID;
    title: string;
    status: NewsStatus;
    summary: string;
    /** Parágrafos em texto puro (comparação com a legenda). */
    paragraphs: string[];
  };
  error?: string;
  attempts?: number;
  ignoredReason?: string;
  /** Quando a reconciliação percebeu a edição/remoção na origem. */
  sourceChangedAt?: ISODateTime;
};

/** Conexão com a conta (ARCHITECTURE §6): polling, token de 60 dias, regra de publicação. */
export type InstagramConnection = {
  username: string;
  lastCheckAt: ISODateTime;
  pollMinutes: number;
  tokenExpiresAt: ISODateTime;
  /** Dias até o token expirar (alerta abaixo de 10; renovação automática a cada 30). */
  tokenDaysLeft: number;
  /** DRAFT = tudo vira rascunho; URGENT_AUTO = urgente publica sozinho. */
  publishRule: "DRAFT" | "URGENT_AUTO";
};

export type DashboardStats = {
  publishedToday: number;
  drafts: number;
  inReview: number;
  scheduled: number;
  instagramNew: number;
  importErrors: number;
  activeCampaigns: number;
  viewsToday: number;
  /** Variação de visualizações vs. ontem, em %. */
  viewsTrendPercent: number;
};

// ---------------------------------------------------------------- editor (FE-154)

/**
 * Notícia em edição — contrato de POST/PUT /api/v1/admin/news. Referências por slug
 * (a API resolve os IDs). O corpo segue o mesmo ArticleBlock do site público.
 */
export type NewsDraft = {
  id?: UUID;
  title: string;
  subtitle: string;
  summary: string;
  body: ArticleBlock[];
  categorySlug: string;
  authorSlugs: string[];
  neighborhoodSlug: string;
  tagSlugs: string[];
  /** Tópicos novos (nomes) criados pela API ao salvar; exige `tags.manage`. */
  newTags: string[];
  image: { url: string; alt: string; caption: string; credit: string };
  isUrgent: boolean;
  isSponsored: boolean;
  sponsorName: string;
  seo: { title: string; description: string };
  status: NewsStatus;
  /** Data/hora local "AAAA-MM-DDTHH:mm" (input datetime-local), fuso de Brasília. */
  scheduledFor: string;
  origin: NewsOrigin;
  /** Legenda original do Instagram (somente leitura, auditoria). */
  instagramCaption?: string;
  updatedAt?: ISODateTime;
};

/** O que o botão pediu: salvar rascunho, mandar para revisão, publicar ou agendar. */
export type SaveIntent = "draft" | "review" | "publish" | "schedule";

export type DraftErrors = Partial<
  Record<keyof NewsDraft | "image.alt" | "image.url" | "body", string>
>;

export type SaveResult =
  | { ok: true; id: UUID; status: NewsStatus; savedAt: ISODateTime; simulated: boolean }
  | { ok: false; errors: DraftErrors; message: string };
