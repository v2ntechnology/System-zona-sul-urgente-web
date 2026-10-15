import { PlusIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NewsTable } from "@/components/admin/news-table";
import { statusLabel } from "@/components/admin/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRoutes } from "@/config/admin-navigation";
import { can } from "@/config/permissions";
import { cn } from "@/lib/utils";
import {
  countAdminNewsByStatus,
  getCurrentUser,
  listAdminNews,
} from "@/services/admin/admin-service";
import { getCategories } from "@/services/taxonomy-service";
import type { AdminNewsFilter } from "@/types/admin";
import type { NewsOrigin, NewsStatus } from "@/types/news";

export const metadata: Metadata = { title: "Notícias" };

const STATUS_TABS: (NewsStatus | "DELETED" | "ALL")[] = [
  "ALL",
  "DRAFT",
  "IN_REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "UNPUBLISHED",
  "DELETED",
];
const STATUSES = new Set<string>(STATUS_TABS);

// Listagem administrativa (FE-153). Filtros e página na URL (?q=&status=&editoria=&origem=&pagina=).
export default function AdminNewsPage({ searchParams }: PageProps<"/admin/noticias">) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Notícias</h1>
        <Link
          href={adminRoutes.newNews}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-blue-dark"
        >
          <PlusIcon aria-hidden className="size-4" /> Nova notícia
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <NewsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Params = Awaited<PageProps<"/admin/noticias">["searchParams"]>;
const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

async function NewsList({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const rawStatus = first(params.status);
  const filter: AdminNewsFilter = {
    query: first(params.q)?.slice(0, 120),
    status:
      rawStatus && rawStatus !== "ALL" && STATUSES.has(rawStatus)
        ? (rawStatus as AdminNewsFilter["status"])
        : undefined,
    categorySlug: first(params.editoria),
    origin:
      first(params.origem) === "INSTAGRAM" || first(params.origem) === "MANUAL"
        ? (first(params.origem) as NewsOrigin)
        : undefined,
    page: Number(first(params.pagina)) || 1,
  };

  const [user, page, counts, categories] = await Promise.all([
    getCurrentUser(),
    listAdminNews(filter),
    countAdminNewsByStatus(),
    getCategories(),
  ]);

  const query = (overrides: Record<string, string | number | undefined>) => {
    const merged = {
      q: filter.query,
      status: filter.status,
      editoria: filter.categorySlug,
      origem: filter.origin,
      pagina: undefined as number | undefined,
      ...overrides,
    };
    const qs = new URLSearchParams(
      Object.entries(merged)
        .filter((e): e is [string, string] => e[1] !== undefined && e[1] !== "")
        .map(([k, v]) => [k, String(v)]),
    );
    return `${adminRoutes.news}${qs.size ? `?${qs}` : ""}`;
  };
  const field = "h-10 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <>
      <nav aria-label="Filtrar por status" className="-mx-1 [scrollbar-width:none] overflow-x-auto">
        <ul className="flex gap-1 px-1">
          {STATUS_TABS.map((status) => {
            const active = (filter.status ?? "ALL") === status;
            return (
              <li key={status}>
                <Link
                  href={query({ status: status === "ALL" ? undefined : status })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
                    active
                      ? "bg-brand-blue text-white"
                      : "bg-background text-muted-foreground ring-1 ring-border hover:text-foreground",
                  )}
                >
                  {status === "ALL"
                    ? "Todas"
                    : status === "DELETED"
                      ? "Lixeira"
                      : statusLabel(status)}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      active ? "bg-white/20" : "bg-muted",
                    )}
                  >
                    {counts[status] ?? 0}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action={adminRoutes.news} className="flex flex-wrap gap-2">
        {filter.status && <input type="hidden" name="status" value={filter.status} />}
        <div className="relative min-w-56 flex-1">
          <label htmlFor="admin-q" className="sr-only">
            Buscar por título ou autor
          </label>
          <SearchIcon
            aria-hidden
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={filter.query}
            placeholder="Buscar por título ou autor"
            className={`${field} w-full pl-9`}
          />
        </div>
        <label htmlFor="admin-editoria" className="sr-only">
          Editoria
        </label>
        <select
          id="admin-editoria"
          name="editoria"
          defaultValue={filter.categorySlug ?? ""}
          className={field}
        >
          <option value="">Todas as editorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.parent ? `— ${c.name}` : c.name}
            </option>
          ))}
        </select>
        <label htmlFor="admin-origem" className="sr-only">
          Origem
        </label>
        <select
          id="admin-origem"
          name="origem"
          defaultValue={filter.origin ?? ""}
          className={field}
        >
          <option value="">Todas as origens</option>
          <option value="MANUAL">Manual</option>
          <option value="INSTAGRAM">Instagram</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md border bg-background px-4 text-sm font-semibold hover:border-brand-blue hover:text-brand-blue"
        >
          Filtrar
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        {page.total === 1 ? "1 notícia" : `${page.total} notícias`}
        {page.pageCount > 1 && ` · página ${page.page} de ${page.pageCount}`}
      </p>

      {/* key: ao trocar filtro/página, a tabela recomeça (descarta o estado das simulações). */}
      <NewsTable
        key={JSON.stringify(filter)}
        rows={page.items}
        canPublish={can(user.role, "news.publish")}
        canDelete={can(user.role, "news.delete")}
      />

      {page.pageCount > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-center gap-1">
          {Array.from({ length: page.pageCount }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={query({ pagina: n === 1 ? undefined : n })}
              aria-current={n === page.page ? "page" : undefined}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-md text-sm font-medium",
                n === page.page
                  ? "bg-brand-blue text-white"
                  : "bg-background ring-1 ring-border hover:text-brand-blue",
              )}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
