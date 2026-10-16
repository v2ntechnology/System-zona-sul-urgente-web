import type { Permission } from "@/types/admin";

// Menu do painel. `permission` esconde o item para quem não pode usar (RBAC, FE-151).
export type AdminNavItem = {
  label: string;
  href: string;
  icon: "dashboard" | "news" | "new" | "instagram" | "analytics" | "ads" | "users" | "design";
  permission?: Permission;
  /** Contador de pendências (ex.: posts do Instagram esperando ação). */
  badge?: number;
};

export const adminRoutes = {
  dashboard: "/admin",
  login: "/admin/login",
  news: "/admin/noticias",
  newNews: "/admin/noticias/nova",
  editNews: (id: string) => `/admin/noticias/${id}`,
  instagram: "/admin/instagram",
  analytics: "/admin/analytics",
  ads: "/admin/publicidade",
  advertisers: "/admin/publicidade/anunciantes",
  adSlots: "/admin/publicidade/posicoes",
  newCampaign: "/admin/publicidade/campanhas/nova",
  campaign: (id: string) => `/admin/publicidade/campanhas/${id}`,
  users: "/admin/usuarios",
  designSystem: "/admin/design-system",
} as const;

/** Itens da navbar (desktop) e da barra inferior (celular). "Nova notícia" é o botão de destaque. */
export const adminNav: AdminNavItem[] = [
  { label: "Dashboard", href: adminRoutes.dashboard, icon: "dashboard" },
  { label: "Notícias", href: adminRoutes.news, icon: "news" },
  {
    label: "Instagram",
    href: adminRoutes.instagram,
    icon: "instagram",
    permission: "instagram.review",
  },
  {
    label: "Analytics",
    href: adminRoutes.analytics,
    icon: "analytics",
    permission: "analytics.view",
  },
  { label: "Publicidade", href: adminRoutes.ads, icon: "ads", permission: "ads.manage" },
  { label: "Usuários", href: adminRoutes.users, icon: "users", permission: "users.manage" },
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
  nova: "Nova notícia",
  login: "Entrar",
  instagram: "Instagram",
  analytics: "Analytics",
  publicidade: "Publicidade",
  anunciantes: "Anunciantes",
  posicoes: "Posições",
  usuarios: "Usuários",
  "design-system": "Design system",
};

/** Trilha: rótulos e links que dependem do caminho inteiro (ex.: "nova" de campanha). */
export const adminPathCrumbs: Record<string, { label: string; href?: string }> = {
  "/admin/publicidade/campanhas": { label: "Campanhas", href: "/admin/publicidade" },
  "/admin/publicidade/campanhas/nova": { label: "Nova campanha" },
};
