import type { Permission } from "@/types/admin";

// Menu do painel. `permission` esconde o item para quem não pode usar (RBAC, FE-151).
export type AdminNavItem = {
  label: string;
  href: string;
  icon: "dashboard" | "news" | "new" | "instagram" | "analytics" | "ads" | "users" | "design";
  permission?: Permission;
};

export const adminRoutes = {
  dashboard: "/admin",
  news: "/admin/noticias",
  newNews: "/admin/noticias/nova",
  editNews: (id: string) => `/admin/noticias/${id}`,
  instagram: "/admin/instagram",
  analytics: "/admin/analytics",
  ads: "/admin/publicidade",
  users: "/admin/usuarios",
  designSystem: "/admin/design-system",
} as const;

export const adminNav: AdminNavItem[] = [
  { label: "Dashboard", href: adminRoutes.dashboard, icon: "dashboard" },
  { label: "Notícias", href: adminRoutes.news, icon: "news" },
  { label: "Nova notícia", href: adminRoutes.newNews, icon: "new", permission: "news.create" },
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
  { label: "Design system", href: adminRoutes.designSystem, icon: "design" },
];

/** Rótulos da trilha (breadcrumb) por segmento de URL. */
export const adminSegmentLabels: Record<string, string> = {
  admin: "Painel",
  noticias: "Notícias",
  nova: "Nova notícia",
  instagram: "Instagram",
  analytics: "Analytics",
  publicidade: "Publicidade",
  usuarios: "Usuários",
  "design-system": "Design system",
};
