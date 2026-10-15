"use client";

import { CameraIcon, EyeIcon, MoreHorizontalIcon, NewspaperIcon, PenLineIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import { RelativeTime } from "@/components/news/relative-time";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminRoutes } from "@/config/admin-navigation";
import { routes } from "@/config/navigation";
import { sectionStyle } from "@/lib/section-color";
import { cn } from "@/lib/utils";
import type { AdminNewsRow } from "@/types/admin";

type Action = "publish" | "unpublish" | "delete" | "restore";

type NewsTableProps = {
  rows: AdminNewsRow[];
  canPublish: boolean;
  canDelete: boolean;
  /** "cards" (padrão, com destaque da mais recente) ou "list" (tabela compacta). */
  view?: "cards" | "list";
  /** Mostra a primeira notícia grande (só na 1ª página, sem busca). */
  hero?: boolean;
};

const views = new Intl.NumberFormat("pt-BR", { notation: "compact" });

const actionMessage: Record<Action, string> = {
  publish: "publicada",
  unpublish: "despublicada",
  delete: "movida para a lixeira",
  restore: "restaurada",
};

// Tabela da listagem administrativa (FE-153). Sem backend, as ações só atualizam a tela
// (simulação); com a API, chamam /api/v1/admin/news/{id}/publish etc. e revalidam a lista.
export function NewsTable({
  rows: initialRows,
  canPublish,
  canDelete,
  view = "cards",
  hero = false,
}: NewsTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState("");
  const [toDelete, setToDelete] = useState<AdminNewsRow | null>(null);

  function apply(row: AdminNewsRow, action: Action) {
    const now = new Date().toISOString();
    setRows((current) =>
      current.map((r) => {
        if (r.id !== row.id) return r;
        if (action === "publish")
          return { ...r, status: "PUBLISHED", publishedAt: r.publishedAt ?? now, updatedAt: now };
        if (action === "unpublish") return { ...r, status: "UNPUBLISHED", updatedAt: now };
        if (action === "delete") return { ...r, deletedAt: now };
        return { ...r, deletedAt: undefined, updatedAt: now };
      }),
    );
    setMessage(`“${row.title}” ${actionMessage[action]} (simulação — sem backend conectado).`);
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
        Nenhuma notícia encontrada com esses filtros.
      </p>
    );
  }

  return (
    <>
      <p
        aria-live="polite"
        className={
          message ? "rounded-md bg-brand-sky-light px-3 py-2 text-sm text-brand-blue" : "sr-only"
        }
      >
        {message}
      </p>

      {view === "cards" && (
        <CardsView
          rows={rows}
          hero={hero}
          actions={(row) => (
            <RowActions
              row={row}
              canPublish={canPublish}
              canDelete={canDelete}
              onAction={apply}
              onDelete={setToDelete}
              floating
            />
          )}
        />
      )}

      {/* Lista — desktop: tabela. */}
      <div
        className={cn(
          "hidden overflow-x-auto rounded-lg border bg-background",
          view === "list" && "lg:block",
        )}
      >
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Título
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Editoria
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Autor
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Origem
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Atualizada
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Views
              </th>
              <th scope="col" className="px-3 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/40">
                <td className="max-w-md px-4 py-3">
                  <Link
                    href={adminRoutes.editNews(row.id)}
                    className="line-clamp-2 font-semibold hover:text-brand-blue hover:underline"
                  >
                    {row.title}
                  </Link>
                  <Flags row={row} />
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={row.deletedAt ? "DELETED" : row.status} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{row.category.name}</td>
                <td className="px-3 py-3">{row.authors.join(", ")}</td>
                <td className="px-3 py-3">
                  <Origin row={row} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                  {row.scheduledFor ? (
                    <>
                      para <RelativeTime iso={row.scheduledFor} />
                    </>
                  ) : (
                    <RelativeTime iso={row.updatedAt} />
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {row.views ? views.format(row.views) : "—"}
                </td>
                <td className="px-3 py-3 text-right">
                  <RowActions
                    row={row}
                    canPublish={canPublish}
                    canDelete={canDelete}
                    onAction={apply}
                    onDelete={setToDelete}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista — celular: cartões compactos. */}
      <ul className={cn("flex flex-col gap-3 lg:hidden", view === "cards" && "hidden")}>
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 rounded-lg border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={adminRoutes.editNews(row.id)}
                className="font-semibold hover:text-brand-blue"
              >
                {row.title}
              </Link>
              <RowActions
                row={row}
                canPublish={canPublish}
                canDelete={canDelete}
                onAction={apply}
                onDelete={setToDelete}
              />
            </div>
            <Flags row={row} />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={row.deletedAt ? "DELETED" : row.status} />
              <span>{row.category.name}</span>
              <span aria-hidden>·</span>
              <span>{row.authors.join(", ")}</span>
              <span aria-hidden>·</span>
              <RelativeTime iso={row.updatedAt} />
              <Origin row={row} />
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover para a lixeira?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.title}” sai do site e vai para a lixeira. Dá para restaurar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (toDelete) apply(toDelete, "delete");
                setToDelete(null);
              }}
            >
              Mover para a lixeira
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Flags({ row }: { row: AdminNewsRow }) {
  if (!row.isUrgent && !row.isSponsored) return null;
  return (
    <div className="mt-1 flex gap-1.5">
      {row.isUrgent && (
        <span className="rounded bg-urgent px-1.5 text-[0.625rem] font-bold text-urgent-foreground uppercase">
          Urgente
        </span>
      )}
      {row.isSponsored && (
        <span className="rounded bg-sponsored px-1.5 text-[0.625rem] font-bold text-sponsored-foreground uppercase">
          Patrocinada
        </span>
      )}
    </div>
  );
}

function Origin({ row }: { row: AdminNewsRow }) {
  return row.origin === "INSTAGRAM" ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue">
      <CameraIcon aria-hidden className="size-3.5" /> Instagram
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <PenLineIcon aria-hidden className="size-3.5" /> Manual
    </span>
  );
}

function RowActions({
  row,
  canPublish,
  canDelete,
  onAction,
  onDelete,
  floating,
}: {
  row: AdminNewsRow;
  canPublish: boolean;
  canDelete: boolean;
  onAction: (row: AdminNewsRow, action: Action) => void;
  onDelete: (row: AdminNewsRow) => void;
  /** Sobre a foto do card: botão redondo com fundo. */
  floating?: boolean;
}) {
  const deleted = Boolean(row.deletedAt);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Ações para “${row.title}”`}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md hover:bg-muted",
          floating && "rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background",
        )}
      >
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {!deleted && (
          <DropdownMenuItem render={<Link href={adminRoutes.editNews(row.id)} />}>
            Editar
          </DropdownMenuItem>
        )}
        {!deleted && row.status === "PUBLISHED" && (
          <DropdownMenuItem render={<Link href={routes.news(row)} target="_blank" />}>
            Ver no site
          </DropdownMenuItem>
        )}
        {canPublish && !deleted && row.status !== "PUBLISHED" && (
          <DropdownMenuItem onClick={() => onAction(row, "publish")}>Publicar</DropdownMenuItem>
        )}
        {canPublish && !deleted && row.status === "PUBLISHED" && (
          <DropdownMenuItem onClick={() => onAction(row, "unpublish")}>
            Despublicar
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            {deleted ? (
              <DropdownMenuItem onClick={() => onAction(row, "restore")}>
                Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
                Excluir
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------- cards (padrão)

type CardsViewProps = {
  rows: AdminNewsRow[];
  hero: boolean;
  actions: (row: AdminNewsRow) => React.ReactNode;
};

// Cards com foto (como as referências de portais): a mais recente em destaque e o resto em
// grade. O link do título cobre o card; o menu de ações fica por cima (z-10).
function CardsView({ rows, hero, actions }: CardsViewProps) {
  const [lead, ...rest] = hero ? rows : [undefined, ...rows];
  return (
    <div className="flex flex-col gap-5">
      {lead && <HeroCard row={lead} actions={actions(lead)} />}
      <ul className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
        {rest.map((row) =>
          row ? (
            <li key={row.id}>
              <NewsCard row={row} actions={actions(row)} />
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}

function Thumb({
  row,
  sizes,
  className,
}: {
  row: AdminNewsRow;
  sizes: string;
  className?: string;
}) {
  return (
    <div
      style={sectionStyle(row.category)}
      className={cn("relative overflow-hidden bg-[color:var(--section)]/10", className)}
    >
      {row.imageUrl ? (
        <Image
          src={row.imageUrl}
          alt=""
          fill
          sizes={sizes}
          className="object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[color:var(--section)]">
          <NewspaperIcon aria-hidden className="size-8 stroke-1" />
          <span className="text-xs font-medium">Sem foto</span>
        </span>
      )}
    </div>
  );
}

function Byline({ row, onDark }: { row: AdminNewsRow; onDark?: boolean }) {
  const initials = (row.authors[0] ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-xs",
        onDark ? "text-white/85" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[0.6rem] font-bold text-white"
      >
        {initials}
      </span>
      <span className="truncate">{row.authors.join(", ")}</span>
      <span aria-hidden>·</span>
      <span className="shrink-0">
        {row.scheduledFor ? (
          <>
            para <RelativeTime iso={row.scheduledFor} />
          </>
        ) : (
          <RelativeTime iso={row.deletedAt ?? row.updatedAt} />
        )}
      </span>
      {row.views > 0 && (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 tabular-nums">
          <EyeIcon aria-hidden className="size-3.5" />
          {views.format(row.views)}
          <span className="sr-only">visualizações</span>
        </span>
      )}
    </div>
  );
}

function Kicker({ row, onDark }: { row: AdminNewsRow; onDark?: boolean }) {
  return (
    <div
      style={sectionStyle(row.category)}
      className="flex flex-wrap items-center gap-2 text-label font-bold tracking-wide uppercase"
    >
      <span className={onDark ? "text-white" : "text-[color:var(--section)]"}>
        {row.category.name}
      </span>
      {row.origin === "INSTAGRAM" && (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-semibold normal-case",
            onDark ? "text-white/85" : "text-brand-blue",
          )}
        >
          <CameraIcon aria-hidden className="size-3.5" /> Instagram
        </span>
      )}
    </div>
  );
}

function CardBadges({ row }: { row: AdminNewsRow }) {
  return (
    <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
      <StatusBadge status={row.deletedAt ? "DELETED" : row.status} className="shadow-sm" />
      {row.isUrgent && (
        <span className="rounded-full bg-urgent px-2 py-0.5 text-xs font-bold text-urgent-foreground shadow-sm">
          Urgente
        </span>
      )}
      {row.isSponsored && (
        <span className="rounded-full bg-sponsored px-2 py-0.5 text-xs font-bold text-sponsored-foreground shadow-sm">
          Patrocinada
        </span>
      )}
    </div>
  );
}

function NewsCard({ row, actions }: { row: AdminNewsRow; actions: React.ReactNode }) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-background shadow-xs transition hover:shadow-md",
        row.deletedAt && "opacity-75",
      )}
    >
      <div className="relative">
        <Thumb
          row={row}
          sizes="(min-width: 1536px) 360px, (min-width: 640px) 45vw, 100vw"
          className="aspect-video"
        />
        <CardBadges row={row} />
        <div className="absolute top-2.5 right-2.5 z-10">{actions}</div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Kicker row={row} />
        <h2 className="line-clamp-3 font-heading text-teaser font-bold">
          <Link
            href={adminRoutes.editNews(row.id)}
            className="group-hover:text-brand-blue after:absolute after:inset-0"
          >
            {row.title}
          </Link>
        </h2>
        <div className="mt-auto pt-2">
          <Byline row={row} />
        </div>
      </div>
    </article>
  );
}

function HeroCard({ row, actions }: { row: AdminNewsRow; actions: React.ReactNode }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl bg-foreground shadow-sm">
      <Thumb
        row={row}
        sizes="(min-width: 1280px) 900px, 100vw"
        className="aspect-[4/3] sm:aspect-[21/9]"
      />
      <CardBadges row={row} />
      <div className="absolute top-3 right-3 z-10">{actions}</div>
      {/* Faixa escura sob o texto: contraste do branco sobre qualquer foto. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-foreground/70 p-5 backdrop-blur-sm sm:p-6">
        <Kicker row={row} onDark />
        <h2 className="line-clamp-3 font-heading text-headline font-bold text-white">
          <Link
            href={adminRoutes.editNews(row.id)}
            className="after:absolute after:inset-0 focus-visible:outline-white"
          >
            {row.title}
          </Link>
        </h2>
        <Byline row={row} onDark />
      </div>
    </article>
  );
}
