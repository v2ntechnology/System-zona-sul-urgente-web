import { LockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BarList, KpiTile, ShareBar } from "@/components/admin/analytics/analytics-parts";
import { ViewsChart } from "@/components/admin/analytics/views-chart";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { Panel } from "@/components/admin/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRoutes } from "@/config/admin-navigation";
import { can } from "@/config/permissions";
import { formatCount, formatDuration } from "@/lib/chart";
import { getCurrentUser } from "@/services/admin/admin-service";
import {
  ANALYTICS_PERIODS,
  getAdMetrics,
  getAnalytics,
  parsePeriod,
} from "@/services/admin/analytics-service";

export const metadata: Metadata = { title: "Analytics" };

const full = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

// Analytics do painel (FE-156): métricas próprias do portal, sem ferramenta externa
// (ARCHITECTURE §12). O período (?periodo=) vale para todos os blocos da página.
export default function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Audiência medida pelo próprio portal, sem dados pessoais. Comparação sempre com o período
          anterior.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-lg" />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Params = Awaited<PageProps<"/admin/analytics">["searchParams"]>;

async function Report({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const period = parsePeriod(Array.isArray(params.periodo) ? params.periodo[0] : params.periodo);
  const user = await getCurrentUser();
  if (!can(user.role, "analytics.view")) notFound();
  const canSeeAds = can(user.role, "analytics.ads.view");

  const [report, ads] = await Promise.all([
    getAnalytics(period),
    canSeeAds ? getAdMetrics(period) : Promise.resolve(null),
  ]);
  const meta = ANALYTICS_PERIODS.find((p) => p.key === period)!;
  const previous = meta.previous.toLowerCase();
  const { totals, previousTotals } = report;

  return (
    <>
      <FilterTabs
        label="Período"
        active={period}
        tabs={ANALYTICS_PERIODS.map((p) => ({
          key: p.key,
          label: p.label,
          href:
            p.key === "hoje" ? adminRoutes.analytics : `${adminRoutes.analytics}?periodo=${p.key}`,
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Visualizações"
          value={totals.views}
          previous={previousTotals.views}
          previousLabel={previous}
        />
        <KpiTile
          label="Visitantes únicos"
          value={totals.visitors}
          previous={previousTotals.visitors}
          previousLabel={previous}
        />
        <KpiTile
          label="Tempo médio de leitura"
          value={totals.avgReadSeconds}
          display={formatDuration(totals.avgReadSeconds)}
          previous={previousTotals.avgReadSeconds}
          previousLabel={previous}
        />
        <KpiTile
          label="Notícias publicadas"
          value={totals.published}
          previous={previousTotals.published}
          previousLabel={previous}
        />
      </div>

      <Panel
        title={report.granularity === "hour" ? "Visualizações por hora" : "Visualizações por dia"}
      >
        <div className="p-4">
          <ViewsChart
            points={report.series}
            granularity={report.granularity}
            previousLabel={meta.previous}
          />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Origem do tráfego">
          <div className="p-4">
            <BarList items={report.sources} total={totals.views} />
          </div>
        </Panel>
        <Panel title="Dispositivos">
          <div className="p-4">
            <ShareBar items={report.devices} />
          </div>
        </Panel>
        <Panel title="Editorias mais acessadas">
          <div className="p-4">
            <BarList items={report.categories} total={totals.views} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Mais lidas no período" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="w-10 px-4 py-2.5 font-semibold">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Notícia
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    Views
                  </th>
                  <th
                    scope="col"
                    className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell"
                  >
                    Leitura média
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.topNews.map((news, i) => (
                  <tr key={news.id}>
                    <td className="px-4 py-2.5 font-heading font-bold text-brand-blue tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={adminRoutes.editNews(news.id)}
                        className="line-clamp-2 font-medium hover:text-brand-blue hover:underline"
                      >
                        {news.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{news.categoryName}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCount(news.views)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                      {formatDuration(news.avgReadSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Em alta agora">
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            Leitores nos últimos 30 minutos.
          </p>
          <ol className="divide-y">
            {report.trending.map((news) => (
              <li key={news.id} className="flex items-center gap-3 px-4 py-3">
                <Link
                  href={adminRoutes.editNews(news.id)}
                  className="line-clamp-2 flex-1 text-sm font-medium hover:text-brand-blue hover:underline"
                >
                  {news.title}
                </Link>
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums">
                  <span
                    aria-hidden
                    className="size-2 animate-pulse rounded-full bg-brand-red motion-reduce:animate-none"
                  />
                  {full.format(news.readersNow)}
                  <span className="sr-only">leitores agora</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {ads ? (
        <Panel title="Publicidade: desempenho por posição">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Posição
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    Impressões
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    Cliques
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    CTR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ads.map((slot) => {
                  const ctr = slot.impressions > 0 ? slot.clicks / slot.impressions : 0;
                  return (
                    <tr key={slot.key}>
                      <td className="px-4 py-2.5">{slot.label}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCount(slot.impressions)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {full.format(slot.clicks)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <strong className="w-14 font-semibold tabular-nums">
                            {percent.format(ctr)}
                          </strong>
                          {/* Medidor: CTR de 0 a 1,5% (faixa típica de display). */}
                          <span aria-hidden className="h-1.5 w-24 rounded-full bg-brand-sky-light">
                            <span
                              className="block h-full rounded-full bg-chart-1"
                              style={{ width: `${Math.min(ctr / 0.015, 1) * 100}%` }}
                            />
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-dashed bg-background px-4 py-3 text-sm text-muted-foreground">
          <LockIcon aria-hidden className="size-4" />
          Impressões, cliques e CTR de anúncios ficam visíveis só para Administrador e Comercial.
        </p>
      )}
    </>
  );
}
