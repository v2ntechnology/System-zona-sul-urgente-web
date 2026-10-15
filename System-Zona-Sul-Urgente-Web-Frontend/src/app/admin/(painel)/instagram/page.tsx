import { AlertTriangleIcon, CameraIcon, KeyRoundIcon, RefreshCwIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FilterTabs } from "@/components/admin/filter-tabs";
import { InstagramQueue } from "@/components/admin/instagram-queue";
import { instagramStatusLabel } from "@/components/admin/instagram-status-badge";
import { RelativeTime } from "@/components/news/relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRoutes } from "@/config/admin-navigation";
import { can } from "@/config/permissions";
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

// Importações do Instagram (FE-155): cada post vira uma notícia (ARCHITECTURE §6). A fila
// mostra o que pede ação primeiro (novos, erros, alterados na origem). Filtro na URL (?status=).
export default function InstagramPage({ searchParams }: PageProps<"/admin/instagram">) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Importações do Instagram</h1>
        <p className="text-sm text-muted-foreground">
          Cada post vira uma notícia em rascunho automaticamente. Aqui você acompanha a fila,
          resolve erros e compara o original com a notícia.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Params = Awaited<PageProps<"/admin/instagram">["searchParams"]>;

async function Queue({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = raw && STATUSES.has(raw) ? (raw as InstagramImportStatus) : undefined;

  const [user, posts, counts, connection] = await Promise.all([
    getCurrentUser(),
    listInstagramPosts(status),
    countInstagramPostsByStatus(),
    getInstagramConnection(),
  ]);
  if (!can(user.role, "instagram.review")) notFound();

  const tokenWarning = connection.tokenDaysLeft < 10;

  return (
    <>
      <section
        aria-label="Conexão com o Instagram"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-background px-4 py-3 text-sm shadow-xs"
      >
        <span className="flex items-center gap-2 font-semibold">
          <CameraIcon aria-hidden className="size-4 text-brand-blue" />@{connection.username}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-600" /> Conectada
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <RefreshCwIcon aria-hidden className="size-3.5" />
          Verifica a cada {connection.pollMinutes} min · última{" "}
          <RelativeTime iso={connection.lastCheckAt} />
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5",
            tokenWarning ? "font-semibold text-red-700" : "text-muted-foreground",
          )}
        >
          {tokenWarning ? (
            <AlertTriangleIcon aria-hidden className="size-3.5" />
          ) : (
            <KeyRoundIcon aria-hidden className="size-3.5" />
          )}
          Acesso válido por {connection.tokenDaysLeft} dias (renova sozinho)
        </span>
        <span className="text-muted-foreground">
          {connection.publishRule === "DRAFT"
            ? "Tudo entra como rascunho"
            : "Urgentes publicam sozinhas"}
        </span>
      </section>

      <FilterTabs
        label="Filtrar por status"
        active={status ?? "ALL"}
        tabs={[
          { key: "ALL", label: "Todos", count: counts.ALL ?? 0, href: adminRoutes.instagram },
          ...INSTAGRAM_STATUSES.map((s) => ({
            key: s,
            label: instagramStatusLabel(s),
            count: counts[s] ?? 0,
            href: `${adminRoutes.instagram}?status=${s}`,
          })),
        ]}
      />

      {/* key: ao trocar o filtro, a lista recomeça (descarta o estado das simulações). */}
      <InstagramQueue key={status ?? "ALL"} posts={posts} userName={user.name} />
    </>
  );
}
