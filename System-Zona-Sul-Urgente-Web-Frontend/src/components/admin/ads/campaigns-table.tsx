"use client";

import { MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CampaignStatusBadge } from "@/components/admin/ads/campaign-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminRoutes } from "@/config/admin-navigation";
import { formatCount } from "@/lib/chart";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/types/admin";

export type CampaignRow = Campaign & {
  period: { range: string; elapsed: number; hint: string; endingSoon: boolean };
  slotLabels: string[];
};

type Action = "pause" | "resume" | "end";
const result: Record<Action, { status: CampaignStatus; text: string }> = {
  pause: { status: "PAUSED", text: "pausada" },
  resume: { status: "ACTIVE", text: "retomada" },
  end: { status: "ENDED", text: "encerrada" },
};

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

// Lista de campanhas (FE-157). Sem backend, pausar/retomar/encerrar só mudam a tela
// (simulação); com a API: POST /api/v1/admin/ads/campaigns/{id}/{pause|resume|end}.
export function CampaignsTable({ rows: initial }: { rows: CampaignRow[] }) {
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState("");

  function apply(row: CampaignRow, action: Action) {
    setRows((current) =>
      current.map((r) => (r.id === row.id ? { ...r, status: result[action].status } : r)),
    );
    setMessage(`“${row.name}” ${result[action].text} (simulação — sem backend conectado).`);
  }

  if (rows.length === 0)
    return (
      <p className="rounded-xl border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
        Nenhuma campanha neste filtro.
      </p>
    );

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
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const ctr = row.impressions > 0 ? row.clicks / row.impressions : 0;
          return (
            <li
              key={row.id}
              className="group relative grid gap-4 rounded-xl border bg-background p-4 shadow-xs transition hover:shadow-md lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-center"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <CampaignStatusBadge status={row.status} />
                  <span className="text-xs text-muted-foreground">{row.advertiser.name}</span>
                </div>
                <Link
                  href={adminRoutes.campaign(row.id)}
                  className="font-heading text-base font-bold group-hover:text-brand-blue after:absolute after:inset-0"
                >
                  {row.name}
                </Link>
                <ul className="flex flex-wrap gap-1">
                  {row.slotLabels.map((label) => (
                    <li key={label} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-1.5 text-sm">
                <span className="tabular-nums">{row.period.range}</span>
                <span aria-hidden className="h-1.5 w-full max-w-48 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-chart-1"
                    style={{ width: `${row.period.elapsed * 100}%` }}
                  />
                </span>
                <span
                  className={cn(
                    "text-xs",
                    row.period.endingSoon && row.status === "ACTIVE"
                      ? "font-semibold text-amber-800"
                      : "text-muted-foreground",
                  )}
                >
                  {row.period.hint}
                </span>
              </div>

              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Impressões</dt>
                  <dd className="font-semibold tabular-nums">{formatCount(row.impressions)}</dd>
                  {row.goalImpressions ? (
                    <dd className="text-xs text-muted-foreground tabular-nums">
                      de {formatCount(row.goalImpressions)}
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Cliques</dt>
                  <dd className="font-semibold tabular-nums">{formatCount(row.clicks)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">CTR</dt>
                  <dd className="font-semibold tabular-nums">
                    {row.impressions > 0 ? percent.format(ctr) : "—"}
                  </dd>
                </div>
              </dl>

              <div className="absolute top-3 right-3 z-10 lg:static">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Ações para “${row.name}”`}
                    className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem render={<Link href={adminRoutes.campaign(row.id)} />}>
                      Ver detalhes
                    </DropdownMenuItem>
                    {row.status === "ACTIVE" && (
                      <DropdownMenuItem onClick={() => apply(row, "pause")}>
                        Pausar
                      </DropdownMenuItem>
                    )}
                    {row.status === "PAUSED" && (
                      <DropdownMenuItem onClick={() => apply(row, "resume")}>
                        Retomar
                      </DropdownMenuItem>
                    )}
                    {(row.status === "ACTIVE" || row.status === "PAUSED") && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => apply(row, "end")}>
                          Encerrar agora
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
