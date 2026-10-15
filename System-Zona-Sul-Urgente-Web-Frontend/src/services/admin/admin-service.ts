import { MOCK_NOW } from "@/mocks/news";
import {
  activeCampaignsMock,
  adminNewsMock,
  currentUserMock,
  instagramPostsMock,
} from "@/mocks/admin";
import { percentChange } from "@/lib/chart";
import { getAnalytics } from "@/services/admin/analytics-service";
import type {
  AdminNewsFilter,
  AdminNewsRow,
  AdminPage,
  AdminUser,
  DashboardStats,
} from "@/types/admin";

// Camada de dados do painel (FE-152/153). Hoje lê mocks; depois chama /api/v1/admin/**
// com o token da sessão (BFF, ARCHITECTURE §8). Mutações ficam em admin-actions.ts.

export const ADMIN_PAGE_SIZE = 15;

/** Usuário logado. Sem login ainda (BE-006): usa o mock. */
export async function getCurrentUser(): Promise<AdminUser> {
  return currentUserMock;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const dayStart = new Date(MOCK_NOW);
  dayStart.setHours(0, 0, 0, 0);
  const alive = adminNewsMock.filter((n) => !n.deletedAt);
  const today = await getAnalytics("hoje");
  return {
    publishedToday: alive.filter(
      (n) =>
        n.status === "PUBLISHED" &&
        n.publishedAt &&
        Date.parse(n.publishedAt) >= dayStart.getTime(),
    ).length,
    drafts: alive.filter((n) => n.status === "DRAFT").length,
    inReview: alive.filter((n) => n.status === "IN_REVIEW").length,
    scheduled: alive.filter((n) => n.status === "SCHEDULED").length,
    instagramNew: instagramPostsMock.filter((p) => p.status === "NEW").length,
    importErrors: instagramPostsMock.filter((p) => p.status === "ERROR").length,
    activeCampaigns: activeCampaignsMock,
    viewsToday: today.totals.views,
    viewsTrendPercent: Math.round(
      percentChange(today.totals.views, today.previousTotals.views) ?? 0,
    ),
  };
}

export async function listAdminNews(
  filter: AdminNewsFilter = {},
): Promise<AdminPage<AdminNewsRow>> {
  const pageSize = Math.min(Math.max(filter.pageSize ?? ADMIN_PAGE_SIZE, 1), 100);
  const terms = normalize(filter.query ?? "")
    .split(/\s+/)
    .filter(Boolean);

  const rows = adminNewsMock
    .filter((n) => (filter.status === "DELETED" ? Boolean(n.deletedAt) : !n.deletedAt))
    .filter((n) => !filter.status || filter.status === "DELETED" || n.status === filter.status)
    .filter(
      (n) =>
        !filter.categorySlug ||
        n.category.slug === filter.categorySlug ||
        n.category.parent?.slug === filter.categorySlug,
    )
    .filter((n) => !filter.origin || n.origin === filter.origin)
    .filter((n) => terms.every((t) => normalize(`${n.title} ${n.authors.join(" ")}`).includes(t)));

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(filter.page ?? 1, 1), pageCount);
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageCount,
  };
}

/** Contagem por status (abas da listagem). */
export async function countAdminNewsByStatus(): Promise<Record<string, number>> {
  const counts: Record<string, number> = { ALL: 0, DELETED: 0 };
  for (const n of adminNewsMock) {
    if (n.deletedAt) {
      counts.DELETED += 1;
      continue;
    }
    counts.ALL += 1;
    counts[n.status] = (counts[n.status] ?? 0) + 1;
  }
  return counts;
}

/** Últimas atualizações (dashboard). */
export async function getRecentlyUpdated(limit = 6): Promise<AdminNewsRow[]> {
  return adminNewsMock.filter((n) => !n.deletedAt).slice(0, limit);
}

export async function getInstagramQueue(limit = 5) {
  return instagramPostsMock
    .filter((p) => p.status === "NEW" || p.status === "ERROR" || p.status === "CHANGED_AT_SOURCE")
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .slice(0, limit);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
