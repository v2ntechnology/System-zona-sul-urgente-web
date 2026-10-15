import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";

import { formatCount, percentChange } from "@/lib/chart";
import { cn } from "@/lib/utils";
import type { AnalyticsShare } from "@/types/admin";

const full = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/** Indicador (stat tile): rótulo, valor e variação contra o período anterior. */
export function KpiTile({
  label,
  value,
  display,
  previous,
  previousLabel,
}: {
  label: string;
  value: number;
  /** Valor formatado (ex.: duração); padrão = número compacto. */
  display?: string;
  previous: number;
  previousLabel: string;
}) {
  const change = percentChange(value, previous);
  const Icon =
    change === null || change === 0
      ? MinusIcon
      : change > 0
        ? ArrowUpRightIcon
        : ArrowDownRightIcon;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-background p-4 shadow-xs">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tracking-tight">{display ?? formatCount(value)}</span>
      {change !== null && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              change > 0 && "text-emerald-700",
              change < 0 && "text-red-700",
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {change > 0 ? "+" : ""}
            {change.toLocaleString("pt-BR")}%
          </span>
          vs. {previousLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Barras horizontais de uma série só (magnitude): uma cor para todas, valor e % na ponta.
 * Todos os valores ficam visíveis, então a lista já é a própria tabela.
 */
export function BarList({ items, total }: { items: AnalyticsShare[]; total: number }) {
  const max = Math.max(...items.map((i) => i.views), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
        >
          <span className="truncate text-sm">{item.label}</span>
          <span className="text-right text-xs text-muted-foreground tabular-nums">
            <strong className="font-semibold text-foreground">{formatCount(item.views)}</strong> ·{" "}
            {percent.format(total > 0 ? item.views / total : 0)}
          </span>
          <span className="col-span-2 h-2 rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-chart-1"
              style={{ width: `${(item.views / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

const shareColors = ["bg-chart-1", "bg-chart-3", "bg-chart-2"];

/**
 * Parte do todo em uma barra empilhada (até 3 fatias, ordem de cores validada para
 * daltonismo). Fatias separadas por 2px de respiro; legenda com valor e % ao lado.
 */
export function ShareBar({ items }: { items: AnalyticsShare[] }) {
  const total = items.reduce((s, i) => s + i.views, 0) || 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-6 gap-0.5" aria-hidden>
        {items.map((item, i) => (
          <span
            key={item.key}
            title={`${item.label}: ${percent.format(item.views / total)}`}
            className={cn("h-full first:rounded-l-md last:rounded-r-md", shareColors[i])}
            style={{ width: `${(item.views / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((item, i) => (
          <li key={item.key} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2.5 rounded-sm", shareColors[i])} />
            <span className="flex-1">{item.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {full.format(item.views)}
            </span>
            <strong className="w-12 text-right font-semibold tabular-nums">
              {percent.format(item.views / total)}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
