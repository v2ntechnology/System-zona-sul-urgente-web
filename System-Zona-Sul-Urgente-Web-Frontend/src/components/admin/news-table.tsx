"use client";

import { CameraIcon, MoreHorizontalIcon, PenLineIcon } from "lucide-react";
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
import type { AdminNewsRow } from "@/types/admin";

type Action = "publish" | "unpublish" | "delete" | "restore";

type NewsTableProps = {
  rows: AdminNewsRow[];
  canPublish: boolean;
  canDelete: boolean;
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
export function NewsTable({ rows: initialRows, canPublish, canDelete }: NewsTableProps) {
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

      {/* Desktop: tabela. */}
      <div className="hidden overflow-x-auto rounded-lg border bg-background lg:block">
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

      {/* Celular: cartões. */}
      <ul className="flex flex-col gap-3 lg:hidden">
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
}: {
  row: AdminNewsRow;
  canPublish: boolean;
  canDelete: boolean;
  onAction: (row: AdminNewsRow, action: Action) => void;
  onDelete: (row: AdminNewsRow) => void;
}) {
  const deleted = Boolean(row.deletedAt);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Ações para “${row.title}”`}
        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
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
