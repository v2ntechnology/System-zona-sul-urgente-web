import type { Permission } from "@/types/admin";

// Menu do painel. `permission` esconde o item para quem não pode usar (RBAC, FE-151).
export type AdminNavItem = {
  label: string;
  href: string;
  icon:
    | "dashboard"
    | "news"
    | "featured"
    | "new"
    | "instagram"
    | "taxonomy"
    | "analytics"
    | "ads"
    | "users"
    | "usage"
    | "design";
  permission?: Permission;
  /** Contador de pendências (ex.: posts do Instagram esperando ação). */
  badge?: number;
};

export const adminRoutes = {
  dashboard: "/admin",
  login: "/admin/login",
  /** Aceite do convite da equipe (link enviado pelo administrador). */
  invite: (token: string) => `/admin/convite/${token}`,
  news: "/admin/noticias",
  newNews: "/admin/noticias/nova",
  editNews: (id: string) => `/admin/noticias/${id}`,
  /** Destaques da home: manchete e destaques (spec 003). */
  featured: "/admin/destaques",
  instagram: "/admin/instagram",
  taxonomy: "/admin/editorias",
  tags: "/admin/editorias/topicos",
  analytics: "/admin/analytics",
  ads: "/admin/publicidade",
  advertisers: "/admin/publicidade/anunciantes",
  adSlots: "/admin/publicidade/posicoes",
  newCampaign: "/admin/publicidade/campanhas/nova",
  campaign: (id: string) => `/admin/publicidade/campanhas/${id}`,
  team: "/admin/equipe",
  authors: "/admin/equipe/autores",
  /** Uso dos planos gratuitos (spec 004); só Administrador. */
  usage: "/admin/uso",
  designSystem: "/admin/design-system",
  /** Painel do projeto (plano, board, histórico, documentos); só em `next dev`. */
  project: "/admin/projeto",
} as const;

/** Itens da navbar (desktop) e da barra inferior (celular). "Nova notícia" é o botão de destaque. */
export const adminNav: AdminNavItem[] = [
  { label: "Dashboard", href: adminRoutes.dashboard, icon: "dashboard" },
  { label: "Notícias", href: adminRoutes.news, icon: "news" },
  {
    label: "Destaques",
    href: adminRoutes.featured,
    icon: "featured",
    permission: "news.publish",
  },
  {
    label: "Instagram",
    href: adminRoutes.instagram,
    icon: "instagram",
    permission: "instagram.review",
  },
  {
    label: "Editorias",
    href: adminRoutes.taxonomy,
    icon: "taxonomy",
    // Repórter só gerencia tópicos; editorias exigem taxonomy.manage (a página confere).
    permission: "tags.manage",
  },
  {
    label: "Analytics",
    href: adminRoutes.analytics,
    icon: "analytics",
    permission: "analytics.view",
  },
  { label: "Publicidade", href: adminRoutes.ads, icon: "ads", permission: "ads.manage" },
  {
    label: "Equipe",
    href: adminRoutes.team,
    icon: "users",
    // Editor cuida dos autores; a aba Equipe (acessos) é só do ADMIN (a página confere).
    permission: "authors.manage",
  },
];

/**
 * Configurações no menu da conta (desktop) e em "Mais" (celular): a navbar em pílula já não cabe
 * mais itens a 1280 px.
 */
export const adminAccountNav: AdminNavItem[] = [
  {
    label: "Uso dos planos",
    href: adminRoutes.usage,
    icon: "usage",
    // Só Administrador (spec 004); a página e a API conferem de novo.
    permission: "settings.manage",
  },
];

export const newNewsItem: AdminNavItem = {
  label: "Nova notícia",
  href: adminRoutes.newNews,
  icon: "new",
  permission: "news.create",
};

/** Rótulos da trilha (breadcrumb) por segmento de URL. */
export const adminSegmentLabels: Record<string, string> = {
  admin: "Painel",
  noticias: "Notícias",
  destaques: "Destaques da home",
  nova: "Nova notícia",
  login: "Entrar",
  instagram: "Instagram",
  analytics: "Analytics",
  publicidade: "Publicidade",
  anunciantes: "Anunciantes",
  editorias: "Editorias",
  topicos: "Tópicos",
  posicoes: "Posições",
  equipe: "Equipe",
  autores: "Autores",
  uso: "Uso dos planos",
  "design-system": "Design system",
  projeto: "Projeto",
};

/** Trilha: rótulos e links que dependem do caminho inteiro (ex.: "nova" de campanha). */
export const adminPathCrumbs: Record<string, { label: string; href?: string }> = {
  "/admin/publicidade/campanhas": { label: "Campanhas", href: "/admin/publicidade" },
  "/admin/publicidade/campanhas/nova": { label: "Nova campanha" },
};
