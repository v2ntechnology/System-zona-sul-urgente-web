"use client";

import {
  CloudIcon,
  DatabaseIcon,
  InfoIcon,
  Loader2Icon,
  LockIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";

import { refreshUsage } from "@/app/admin/(painel)/uso/actions";
import { formatPercent, formatTime } from "@/lib/format";
import {
  barPercent,
  displayLevel,
  formatResetsAt,
  formatUsageAmount,
  formatUsedOfLimit,
  hasLimit,
} from "@/lib/usage";
import { cn } from "@/lib/utils";
import type { UsageLevel, UsageReport, UsageResource } from "@/types/admin";

const primaryButton =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-brand-blue-dark disabled:pointer-events-none disabled:opacity-60";

/** Cor por nível. O texto do nível também aparece: a cor nunca é a única pista. */
const levels: Record<UsageLevel, { label: string; bar: string; text: string; badge: string }> = {
  NORMAL: {
    label: "Normal",
    bar: "bg-emerald-500",
    text: "text-emerald-700",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  WARN: {
    label: "Atenção",
    bar: "bg-amber-500",
    text: "text-amber-700",
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
  },
  CRITICAL: {
    label: "Crítico",
    bar: "bg-red-600",
    text: "text-red-700",
    badge: "bg-red-50 text-red-800 ring-red-200",
  },
};

const badge =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset";

// Tela Uso dos planos (spec 004): um cartão por recurso, com a barra usado/limite na cor do nível.
// "Atualizar agora" lê a Cloudflare na hora (Server Action; a API aceita 1 por minuto).
export function UsageOverview({ initial }: { initial: UsageReport }) {
  const [report, setReport] = useState(initial);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1_000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function refresh() {
    setMessage("");
    startTransition(async () => {
      const result = await refreshUsage().catch(() => ({
        ok: false as const,
        message: "Não foi possível atualizar agora. Tente de novo em instantes.",
        retryAfterSeconds: undefined,
      }));
      if (result.ok) {
        setReport(result.report);
        setMessage(
          result.report.refreshedAt
            ? `Números atualizados às ${formatTime(result.report.refreshedAt)}.`
            : "Números atualizados.",
        );
        setCooldown(60);
        return;
      }
      if (result.message === "simulated") {
        setMessage("Demonstração: sem a API, os números são de exemplo e não vêm da Cloudflare.");
        return;
      }
      setMessage(result.message);
      if (result.retryAfterSeconds) setCooldown(result.retryAfterSeconds);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {report.refreshedAt
            ? `Última leitura às ${formatTime(report.refreshedAt)} (horário de Brasília).`
            : "Ainda sem leitura dos números."}
        </p>
        <button
          type="button"
          className={cn(primaryButton, "sm:ml-auto")}
          onClick={refresh}
          disabled={pending || cooldown > 0}
        >
          {pending ? (
            <Loader2Icon aria-hidden className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon aria-hidden className="size-4" />
          )}
          {pending
            ? "Atualizando…"
            : cooldown > 0
              ? `Atualizar em ${cooldown} s`
              : "Atualizar agora"}
        </button>
      </div>

      <p
        aria-live="polite"
        className={
          message ? "rounded-md bg-brand-sky-light px-3 py-2 text-sm text-brand-blue" : "sr-only"
        }
      >
        {message}
      </p>

      {report.resources.length === 0 ? (
        <p className="rounded-lg border bg-background p-6 text-center text-sm text-muted-foreground">
          Nenhum recurso configurado para monitorar.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {report.resources.map((resource) => (
            <li key={resource.key}>
              <UsageCard resource={resource} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsageCard({ resource }: { resource: UsageResource }) {
  const titleId = useId();
  const level = displayLevel(resource);
  const style = levels[level];
  const limited = hasLimit(resource);
  const percent = barPercent(resource);
  const SourceIcon = resource.source === "cloud" ? CloudIcon : DatabaseIcon;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex h-full flex-col gap-3 rounded-lg border bg-background p-4 shadow-xs",
        level === "CRITICAL" && "border-red-300",
        level === "WARN" && "border-amber-300",
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <h2 id={titleId} className="mr-auto font-heading text-base font-bold">
          {resource.label}
        </h2>
        {resource.locked && (
          <span className={cn(badge, "bg-red-600 text-white ring-red-700")}>
            <LockIcon aria-hidden className="size-3" /> Travado
          </span>
        )}
        {resource.stale && (
          <span className={cn(badge, "bg-amber-50 text-amber-900 ring-amber-300")}>
            <TriangleAlertIcon aria-hidden className="size-3" /> Desatualizado
          </span>
        )}
        {limited && <span className={cn(badge, style.badge)}>{style.label}</span>}
      </div>

      {limited ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm tabular-nums">
              {formatUsedOfLimit(resource.used, resource.limit, resource.unit)}
            </span>
            <span className={cn("text-2xl font-bold tabular-nums", style.text)}>
              {formatPercent(resource.percent ?? percent)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-labelledby={titleId}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            aria-valuetext={`${formatPercent(resource.percent ?? percent)} usado (${formatUsedOfLimit(resource.used, resource.limit, resource.unit)})`}
            className="relative h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn("h-full rounded-full transition-[width]", style.bar)}
              style={{ width: `${percent}%` }}
            />
            {resource.lockAt !== null && resource.lockAt < 100 && (
              // Marca onde a trava liga.
              <span
                aria-hidden
                className="absolute inset-y-0 w-0.5 bg-foreground/50"
                style={{ left: `${resource.lockAt}%` }}
              />
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-red-700">Sem limite configurado</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatUsageAmount(resource.used, resource.unit)} usados
          </span>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
        <SourceIcon aria-hidden className="size-3.5" />
        <span>{resource.source === "cloud" ? "Cloudflare" : "conta do sistema"}</span>
        {resource.readAt && (
          <>
            <span aria-hidden>·</span>
            <span>lido às {formatTime(resource.readAt)}</span>
          </>
        )}
        {resource.resetsAt && (
          <>
            <span aria-hidden>·</span>
            <span>{formatResetsAt(resource.resetsAt, resource.readAt)}</span>
          </>
        )}
        {limited && (
          <>
            <span aria-hidden>·</span>
            <span>
              {resource.lockAt === null ? "só avisa, não trava" : `trava em ${resource.lockAt}%`}
            </span>
          </>
        )}
      </p>

      {resource.note && (
        <p className="flex items-start gap-1.5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          {resource.note}
        </p>
      )}
    </article>
  );
}
