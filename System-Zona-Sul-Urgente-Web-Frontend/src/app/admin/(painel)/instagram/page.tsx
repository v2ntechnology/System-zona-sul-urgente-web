import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  BanIcon,
  CheckCircle2Icon,
  Grid3x3Icon,
  KeyRoundIcon,
  ListIcon,
  PenLineIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { InstagramQueue } from "@/components/admin/instagram-queue";
import { instagramStatusLabel } from "@/components/admin/instagram-status-badge";
import { BrandLogo } from "@/components/brand/brand-logo";
import { RelativeTime } from "@/components/news/relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRoutes } from "@/config/admin-navigation";
import { can } from "@/config/permissions";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/services/admin/admin-service";
import {
  countInstagramPostsByStatus,
  getInstagramConnection,
  INSTAGRAM_STATUSES,
  listInstagramPosts,
} from "@/services/admin/instagram-service";
import type { InstagramImportStatus } from "@/types/admin";

export const metadata: Metadata = { title: "Importações do Instagram" };

const STATUSES = new Set<string>(INSTAGRAM_STATUSES);

const highlightIcons: Record<InstagramImportStatus | "ALL", typeof Grid3x3Icon> = {
  ALL: Grid3x3Icon,
  NEW: SparklesIcon,
  ERROR: AlertTriangleIcon,
  CHANGED_AT_SOURCE: PenLineIcon,
  IMPORTED: CheckCircle2Icon,
  IGNORED: BanIcon,
  REMOVED_AT_SOURCE: Trash2Icon,
};
const highlightLabels: Partial<Record<InstagramImportStatus | "ALL", string>> = {
  ALL: "Todos",
  CHANGED_AT_SOURCE: "Alterados",
  REMOVED_AT_SOURCE: "Removidos",
};

// Importações do Instagram (FE-155) com a cara do perfil da conta (pedido 2026-10-15):
// cabeçalho do perfil, destaques = filtros por status, grade de posts. Clicar num post abre
// como no Instagram, com as ações (gerar, reprocessar, ignorar, comparar, ver no Instagram).
// A aba "Fila" mantém a lista detalhada. Filtros na URL (?status=&visao=fila).
export default function InstagramPage({ searchParams }: PageProps<"/admin/instagram">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[40rem] max-w-4xl rounded-xl" />}>
      <Profile searchParams={searchParams} />
    </Suspense>
  );
}

type Params = Awaited<PageProps<"/admin/instagram">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Profile({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const raw = first(params.status);
  const status = raw && STATUSES.has(raw) ? (raw as InstagramImportStatus) : undefined;
  const view = first(params.visao) === "fila" ? "list" : "grid";

  const [user, posts, counts, connection] = await Promise.all([
    getCurrentUser(),
    listInstagramPosts(status),
    countInstagramPostsByStatus(),
    getInstagramConnection(),
  ]);
  if (!can(user.role, "instagram.review")) notFound();

  const pending = (counts.NEW ?? 0) + (counts.ERROR ?? 0) + (counts.CHANGED_AT_SOURCE ?? 0);
  const tokenWarning = connection.tokenDaysLeft < 10;
  const href = (overrides: { status?: string; visao?: string }) => {
    const qs = new URLSearchParams(
      Object.entries({ status, visao: view === "list" ? "fila" : undefined, ...overrides }).filter(
        (e): e is [string, string] => Boolean(e[1]),
      ),
    );
    return `${adminRoutes.instagram}${qs.size ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Cabeçalho do perfil. */}
      <header className="flex items-start gap-5 px-1 sm:items-center sm:gap-12 sm:px-6">
        <span className="shrink-0 rounded-full p-1 ring-2 ring-brand-red">
          <BrandLogo variant="badge" asLink={false} className="text-[0.32rem] sm:text-[0.55rem]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-normal">{connection.username}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-600" /> Conectada
            </span>
            <a
              href={siteConfig.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-muted px-3 text-sm font-semibold hover:bg-border"
            >
              Ver perfil <ArrowUpRightIcon aria-hidden className="size-3.5" />
            </a>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <li>
              <strong className="font-semibold">{counts.ALL ?? 0}</strong> publicações
            </li>
            <li>
              <strong className="font-semibold">{counts.IMPORTED ?? 0}</strong> viraram notícia
            </li>
            <li>
              <strong className={cn("font-semibold", pending > 0 && "text-brand-red")}>
                {pending}
              </strong>{" "}
              pedem ação
            </li>
          </ul>
          <div className="flex flex-col gap-0.5 text-sm">
            <p className="font-semibold">Zona Sul Urgente</p>
            <p className="flex items-start gap-1.5 text-muted-foreground">
              <RefreshCwIcon aria-hidden className="mt-1 size-3.5 shrink-0" />
              <span>
                Verifica posts novos a cada {connection.pollMinutes} min · última{" "}
                <RelativeTime iso={connection.lastCheckAt} />
              </span>
            </p>
            <p
              className={cn(
                "flex items-start gap-1.5",
                tokenWarning ? "font-semibold text-red-700" : "text-muted-foreground",
              )}
            >
              {tokenWarning ? (
                <AlertTriangleIcon aria-hidden className="mt-1 size-3.5 shrink-0" />
              ) : (
                <KeyRoundIcon aria-hidden className="mt-1 size-3.5 shrink-0" />
              )}
              <span>Acesso válido por {connection.tokenDaysLeft} dias (renova sozinho)</span>
            </p>
            <p className="text-muted-foreground">
              {connection.publishRule === "DRAFT"
                ? "Cada post vira uma notícia em rascunho automaticamente."
                : "Urgentes publicam sozinhas; o resto vira rascunho."}
            </p>
          </div>
        </div>
      </header>

      {/* Destaques (como os "stories fixados") = filtros por status. */}
      <nav aria-label="Filtrar por status">
        <ul className="flex [scrollbar-width:none] gap-4 overflow-x-auto px-1 pt-1 pb-1 sm:gap-8 sm:px-6">
          {(["ALL", ...INSTAGRAM_STATUSES] as const).map((key) => {
            const Icon = highlightIcons[key];
            const active = (status ?? "ALL") === key;
            const count = counts[key] ?? 0;
            const attention = key === "NEW" || key === "ERROR" || key === "CHANGED_AT_SOURCE";
            const label =
              highlightLabels[key] ?? (key === "ALL" ? "Todos" : instagramStatusLabel(key));
            return (
              <li key={key} className="shrink-0">
                <Link
                  href={href({ status: key === "ALL" ? undefined : key })}
                  aria-current={active ? "page" : undefined}
                  className="group flex w-16 flex-col items-center gap-1.5 sm:w-20"
                >
                  <span
                    className={cn(
                      "relative flex size-16 items-center justify-center rounded-full p-0.5 ring-2 ring-offset-2 ring-offset-background transition sm:size-20",
                      active
                        ? "ring-brand-blue"
                        : attention && count > 0
                          ? "ring-brand-red"
                          : "ring-border group-hover:ring-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-full items-center justify-center rounded-full",
                        active ? "bg-brand-blue text-white" : "bg-muted text-foreground",
                      )}
                    >
                      <Icon aria-hidden className="size-6 sm:size-7" strokeWidth={1.75} />
                    </span>
                    <span
                      className={cn(
                        "absolute -right-1 -bottom-1 min-w-6 rounded-full px-1.5 text-center text-xs leading-6 font-bold tabular-nums ring-2 ring-background",
                        attention && count > 0
                          ? "bg-brand-red text-white"
                          : "bg-background text-foreground ring-border",
                      )}
                    >
                      {count}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "w-full truncate text-center text-xs",
                      active ? "font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Abas como as do perfil: Publicações (grade) e Fila (lista detalhada). */}
      <div className="flex flex-col gap-3">
        <nav aria-label="Visualização" className="flex justify-center gap-12 border-t">
          {(
            [
              ["grid", "Publicações", Grid3x3Icon, href({ visao: undefined })],
              ["list", "Fila", ListIcon, href({ visao: "fila" })],
            ] as const
          ).map(([key, label, Icon, url]) => (
            <Link
              key={key}
              href={url}
              aria-current={view === key ? "page" : undefined}
              className={cn(
                "-mt-px inline-flex items-center gap-1.5 border-t py-3 text-xs font-semibold tracking-widest uppercase transition",
                view === key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-3.5" /> {label}
            </Link>
          ))}
        </nav>

        {/* key: ao trocar filtro/visão, recomeça (descarta o estado das simulações). */}
        <InstagramQueue
          key={`${status ?? "ALL"}-${view}`}
          posts={posts}
          userName={user.name}
          view={view}
        />
      </div>
    </div>
  );
}
