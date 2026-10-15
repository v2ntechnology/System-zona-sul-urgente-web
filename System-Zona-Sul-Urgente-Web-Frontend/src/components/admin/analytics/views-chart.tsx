"use client";

import { useEffect, useRef, useState } from "react";

import { formatCount, niceTicks } from "@/lib/chart";
import type { AnalyticsPoint } from "@/types/admin";

type ViewsChartProps = {
  points: AnalyticsPoint[];
  granularity: "hour" | "day";
  /** Nome do período anterior na legenda (ex.: "Ontem"). */
  previousLabel: string;
};

const HEIGHT = 240;
const PAD = { top: 12, right: 16, bottom: 28, left: 56 };

const hourFormat = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const weekdayFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const full = new Intl.NumberFormat("pt-BR");

// Visualizações ao longo do período (FE-156): período atual em destaque (azul) e o anterior
// como contexto (cinza). Linha 2px, grade fina, crosshair que acha o ponto mais próximo
// (mouse, toque e setas do teclado) e tabela equivalente para leitores de tela.
export function ViewsChart({ points, granularity, previousLabel }: ViewsChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ticks = niceTicks(Math.max(...points.flatMap((p) => [p.views, p.previous]), 1));
  const top = ticks.at(-1) ?? 1;
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : 0);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const path = (key: "views" | "previous") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p[key])}`).join("");
  const area = `${path("views")}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;

  const label = (iso: string) =>
    granularity === "hour" ? hourFormat.format(new Date(iso)) : dayFormat.format(new Date(iso));
  // O último dia é o de hoje, ainda em andamento.
  const longLabel = (iso: string) =>
    granularity === "hour"
      ? hourFormat.format(new Date(iso))
      : `${weekdayFormat.format(new Date(iso))}${iso === points.at(-1)?.at ? " (até agora)" : ""}`;
  // Rótulos do eixo X sem encavalar: ~1 a cada 80px.
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 80))));

  function pick(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const ratio = (clientX - rect.left - PAD.left) / plotW;
    setActive(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? points.length - 1) + step)));
  }

  const current = active === null ? null : points[active];
  // Tooltip ao lado do crosshair (nunca em cima do ponto); vira para a esquerda perto da borda.
  const TOOLTIP_W = 176;
  const tooltipLeft =
    active === null
      ? 0
      : x(active) + 12 + TOOLTIP_W > width
        ? x(active) - 12 - TOOLTIP_W
        : x(active) + 12;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-chart-1" /> Período atual
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-chart-context" /> {previousLabel}
        </span>
      </figcaption>

      <div
        ref={wrapRef}
        role="group"
        tabIndex={0}
        aria-label="Gráfico de visualizações. Use as setas para ler cada ponto; a tabela abaixo tem todos os valores."
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((i) => i ?? points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
        className="relative touch-pan-y rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <svg width={width} height={HEIGHT} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(t)}
                y2={y(t)}
                className="stroke-chart-grid"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {formatCount(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            (i % every === 0 && points.length - 1 - i >= every) || i === points.length - 1 ? (
              <text
                key={p.at}
                x={x(i)}
                y={HEIGHT - 8}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {label(p.at)}
              </text>
            ) : null,
          )}

          <path d={area} className="fill-chart-1 opacity-10" />
          <path
            d={path("previous")}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-chart-context"
          />
          <path
            d={path("views")}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-chart-1"
          />
          {/* Ponto final do período atual (anel na cor da superfície). */}
          {points.length > 0 && (
            <circle
              cx={x(points.length - 1)}
              cy={y(points.at(-1)!.views)}
              r={4}
              strokeWidth={2}
              className="fill-chart-1 stroke-background"
            />
          )}

          {current && active !== null && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                className="stroke-muted-foreground/50"
                strokeWidth={1}
              />
              <circle
                cx={x(active)}
                cy={y(current.previous)}
                r={4}
                strokeWidth={2}
                className="fill-chart-context stroke-background"
              />
              <circle
                cx={x(active)}
                cy={y(current.views)}
                r={5}
                strokeWidth={2}
                className="fill-chart-1 stroke-background"
              />
            </g>
          )}
        </svg>

        {current && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-2 z-10 w-44 rounded-md border bg-background px-3 py-2 text-xs shadow-md"
            style={{ left: tooltipLeft }}
          >
            <p className="mb-1 font-medium text-muted-foreground capitalize">
              {longLabel(current.at)}
            </p>
            <p className="flex items-center gap-2">
              <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-1" />
              <strong className="text-sm tabular-nums">{full.format(current.views)}</strong>
              <span className="text-muted-foreground">atual</span>
            </p>
            <p className="flex items-center gap-2">
              <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-context" />
              <strong className="text-sm tabular-nums">{full.format(current.previous)}</strong>
              <span className="text-muted-foreground">anterior</span>
            </p>
          </div>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {current &&
          `${longLabel(current.at)}: ${full.format(current.views)} visualizações; período anterior ${full.format(current.previous)}.`}
      </p>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-brand-blue">
          Ver tabela
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-semibold">
                  {granularity === "hour" ? "Hora" : "Dia"}
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                  Atual
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                  {previousLabel}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {points.map((p) => (
                <tr key={p.at}>
                  <td className="px-3 py-1.5 capitalize">{longLabel(p.at)}</td>
                  <td className="px-3 py-1.5 text-right">{full.format(p.views)}</td>
                  <td className="px-3 py-1.5 text-right">{full.format(p.previous)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
