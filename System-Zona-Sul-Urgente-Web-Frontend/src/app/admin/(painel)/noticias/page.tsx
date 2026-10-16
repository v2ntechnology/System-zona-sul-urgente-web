import { HashIcon, LayoutGridIcon, ListIcon, NewspaperIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import { RemoteImage } from "@/components/media/remote-image";
import Link from "next/link";
import { Suspense } from "react";

import { FilterTabs } from "@/components/admin/filter-tabs";
import { NewsTable } from "@/components/admin/news-table";
import { Panel, PanelEmpty } from "@/components/admin/panel";
import { statusLabel } from "@/components/admin/status-badge";
import { RelativeTime } from "@/components/news/relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRoutes } from "@/config/admin-navigation";
import { routes } from "@/config/navigation";
import { can } from "@/config/permissions";
import { sectionStyle } from "@/lib/section-color";
import { cn } from "@/lib/utils";
import {
  countAdminNewsByStatus,
  getCurrentUser,
  getReviewQueue,
  getTrendingTags,
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
const PAGE_SIZE_CARDS = 13; // 1 destaque + 12 cards (grade de 2 ou 3 colunas fecha certinho)

// Listagem administrativa (FE-153), no visual de portal das referências: abas de status,
// editorias em chips, destaque da mais recente, cards com foto e lateral com a fila de
// revisão e os tópicos em alta. Tudo na URL (?q=&status=&editoria=&origem=&pagina=&visao=).
export default function AdminNewsPage({ searchParams }: PageProps<"/admin/noticias">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] rounded-xl" />}>
      <NewsList searchParams={searchParams} />
    </Suspense>
  );
}

type Params = Awaited<PageProps<"/admin/noticias">["searchParams"]>;
const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

async function NewsList({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const rawStatus = first(params.status);
  const view = first(params.visao) === "lista" ? "list" : "cards";
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
    pageSize: view === "cards" ? PAGE_SIZE_CARDS : undefined,
  };

  const [user, page, counts, categories, review, trending] = await Promise.all([
    getCurrentUser(),
    listAdminNews(filter),
    countAdminNewsByStatus(),
    getCategories(),
    getReviewQueue(4),
    getTrendingTags(6),
  ]);

  const query = (overrides: Record<string, string | number | undefined>) => {
    const merged = {
      q: filter.query,
      status: filter.status,
      editoria: filter.categorySlug,
      origem: filter.origin,
      visao: view === "list" ? "lista" : undefined,
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
  const roots = categories.filter((c) => !c.parent);
  const activeRoot = categories.find((c) => c.slug === filter.categorySlug);
  const activeRootSlug = activeRoot?.parent?.slug ?? activeRoot?.slug;
  const hero = view === "cards" && page.page === 1 && !filter.query;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Notícias</h1>
          <p className="text-sm text-muted-foreground">
            {page.total === 1 ? "1 notícia" : `${page.total} notícias`}
            {filter.query && (
              <>
                {" "}
                para <strong className="text-foreground">“{filter.query}”</strong>
              </>
            )}
            {page.pageCount > 1 && ` · página ${page.page} de ${page.pageCount}`}
          </p>
        </div>
        <form
          method="get"
          action={adminRoutes.news}
          className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap"
        >
          {filter.status && <input type="hidden" name="status" value={filter.status} />}
          {filter.categorySlug && (
            <input type="hidden" name="editoria" value={filter.categorySlug} />
          )}
          {view === "list" && <input type="hidden" name="visao" value="lista" />}
          <div className="relative min-w-0 basis-full sm:w-80 sm:basis-auto">
            <label htmlFor="admin-q" className="sr-only">
              Buscar por título ou autor
            </label>
            <SearchIcon
              aria-hidden
              className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="admin-q"
              name="q"
              type="search"
              defaultValue={filter.query}
              placeholder="Buscar por título ou autor"
              className="h-10 w-full rounded-full border bg-background pr-4 pl-10 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <label htmlFor="admin-origem" className="sr-only">
            Origem
          </label>
          <select
            id="admin-origem"
            name="origem"
            defaultValue={filter.origin ?? ""}
            className="h-10 min-w-0 flex-1 rounded-full border bg-background px-3 text-sm shadow-xs sm:flex-none"
          >
            <option value="">Todas as origens</option>
            <option value="MANUAL">Manual</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-dark"
          >
            Buscar
          </button>
        </form>
      </div>

      <FilterTabs
        label="Filtrar por status"
        variant="underline"
        active={filter.status ?? "ALL"}
        tabs={STATUS_TABS.map((status) => ({
          key: status,
          label:
            status === "ALL" ? "Todas" : status === "DELETED" ? "Lixeira" : statusLabel(status),
          count: counts[status] ?? 0,
          href: query({ status: status === "ALL" ? undefined : status }),
        }))}
      />

      <div className="flex items-center gap-3">
        <nav aria-label="Filtrar por editoria" className="min-w-0 flex-1">
          <ul className="-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 py-0.5">
            <li>
              <Chip href={query({ editoria: undefined })} active={!filter.categorySlug}>
                Todas as editorias
              </Chip>
            </li>
            {roots.map((c) => (
              <li key={c.id}>
                <Chip
                  href={query({ editoria: c.slug })}
                  active={activeRootSlug === c.slug}
                  category={c}
                >
                  {c.name}
                </Chip>
              </li>
            ))}
          </ul>
        </nav>
        <div
          role="group"
          aria-label="Visualização"
          className="flex shrink-0 rounded-full border bg-background p-0.5 shadow-xs"
        >
          <ViewLink href={query({ visao: undefined })} active={view === "cards"} label="Cards">
            <LayoutGridIcon aria-hidden className="size-4" />
          </ViewLink>
          <ViewLink href={query({ visao: "lista" })} active={view === "list"} label="Lista">
            <ListIcon aria-hidden className="size-4" />
          </ViewLink>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* key: ao trocar filtro/página, a lista recomeça (descarta o estado das simulações). */}
          <NewsTable
            key={JSON.stringify(filter)}
            rows={page.items}
            view={view}
            hero={hero}
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
                    "inline-flex size-9 items-center justify-center rounded-full text-sm font-medium",
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
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-24 xl:self-start">
          <Panel
            title="Aguardando revisão"
            action={{
              label: "Ver todas",
              href: query({ status: "IN_REVIEW", editoria: undefined }),
            }}
          >
            {review.length === 0 ? (
              <PanelEmpty>Nada esperando revisão.</PanelEmpty>
            ) : (
              <ul className="divide-y">
                {review.map((row) => (
                  <li key={row.id} className="group relative flex gap-3 px-4 py-3">
                    <div
                      style={sectionStyle(row.category)}
                      className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-[color:var(--section)]/10"
                    >
                      {row.imageUrl ? (
                        <RemoteImage
                          src={row.imageUrl}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <NewspaperIcon
                          aria-hidden
                          className="absolute inset-0 m-auto size-6 stroke-1 text-[color:var(--section)]"
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link
                        href={adminRoutes.editNews(row.id)}
                        className="line-clamp-2 text-sm leading-snug font-semibold group-hover:text-brand-blue after:absolute after:inset-0"
                      >
                        {row.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {row.authors[0]} · <RelativeTime iso={row.updatedAt} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Tópicos em alta">
            {trending.length === 0 ? (
              <PanelEmpty>Sem tópicos nas últimas 48 h.</PanelEmpty>
            ) : (
              <ol className="divide-y">
                {trending.map((tag, i) => (
                  <li key={tag.slug} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-4 text-sm font-bold text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={routes.search + `?q=${encodeURIComponent(tag.name)}`}
                        target="_blank"
                        className="inline-flex items-center gap-0.5 truncate text-sm font-semibold hover:text-brand-blue"
                      >
                        <HashIcon aria-hidden className="size-3.5 text-brand-red" />
                        {tag.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {tag.count === 1 ? "1 notícia" : `${tag.count} notícias`} nas últimas 48 h
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  category,
  children,
}: {
  href: string;
  active: boolean;
  category?: { slug: string; parent?: { slug: string } };
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={category ? sectionStyle(category) : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap ring-1 transition",
        active
          ? "bg-foreground text-background ring-foreground"
          : "bg-background text-muted-foreground ring-border hover:text-foreground",
      )}
    >
      {category && <span aria-hidden className="size-2 rounded-full bg-[color:var(--section)]" />}
      {children}
    </Link>
  );
}

function ViewLink({
  href,
  active,
  label,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full transition",
        active ? "bg-brand-blue text-white" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
