import { adSlots } from "@/mocks/ads";
import {
  adSlotCtrMock,
  categoryShareMock,
  dailyViewsMock,
  deviceShareMock,
  hourlyViewsMock,
  publishedMock,
  sourceShareMock,
  TODAY_START,
} from "@/mocks/analytics";
import { newsMock, viewsBySlug } from "@/mocks/news";
import { findCategory } from "@/mocks/taxonomy";
import type {
  AdSlotMetrics,
  AnalyticsPeriod,
  AnalyticsPoint,
  AnalyticsReport,
  AnalyticsTotals,
} from "@/types/admin";

// Analytics do painel (FE-156). Hoje calcula sobre mocks; depois chama
// GET /api/v1/admin/analytics?period= (agregados próprios, ARCHITECTURE §12).
// Perfis com "próprias" (REPÓRTER, AUTOR) receberão da API só as próprias matérias.

export const ANALYTICS_PERIODS: { key: AnalyticsPeriod; label: string; previous: string }[] = [
  { key: "hoje", label: "Hoje", previous: "Ontem" },
  { key: "24h", label: "24 horas", previous: "24 h anteriores" },
  { key: "7d", label: "7 dias", previous: "7 dias anteriores" },
  { key: "30d", label: "30 dias", previous: "30 dias anteriores" },
];

export function parsePeriod(value: string | undefined): AnalyticsPeriod {
  return ANALYTICS_PERIODS.some((p) => p.key === value) ? (value as AnalyticsPeriod) : "hoje";
}

export async function getAnalytics(period: AnalyticsPeriod): Promise<AnalyticsReport> {
  const series = buildSeries(period);
  const views = sum(series.map((p) => p.views));
  const previousViews = sum(series.map((p) => p.previous));
  const [published, previousPublished] = publishedMock[period];
  const totals = totalsFor(views, published, 1);
  const previousTotals = totalsFor(previousViews, previousPublished, 0.97);

  const viewsKey = period === "7d" ? "week" : period === "30d" ? "total" : "day";
  const ranked = newsMock
    .filter((n) => !n.isSponsored)
    .map((n) => ({ news: n, views: viewsBySlug.get(n.slug)?.[viewsKey] ?? 0 }))
    .sort((a, b) => b.views - a.views);

  return {
    period,
    granularity: period === "7d" || period === "30d" ? "day" : "hour",
    totals,
    previousTotals,
    series,
    sources: shares(sourceShareMock, views),
    devices: shares(deviceShareMock, views),
    categories: Object.entries(categoryShareMock)
      .map(([slug, share]) => ({
        key: slug,
        label: findCategory(slug).name,
        views: Math.round(views * share),
      }))
      .sort((a, b) => b.views - a.views),
    topNews: ranked.slice(0, 10).map(({ news, views: v }) => ({
      id: news.id,
      title: news.title,
      categoryName: news.category.name,
      views: v,
      avgReadSeconds: 40 + ((news.readingTimeMinutes * 23 + v) % 90),
    })),
    trending: ranked.slice(0, 5).map(({ news, views: v }, i) => ({
      id: news.id,
      title: news.title,
      readersNow: Math.max(12, Math.round(v / 40) - i * 17),
    })),
  };
}

/** Impressões, cliques e CTR por posição (só para quem tem analytics.ads.view). */
export async function getAdMetrics(period: AnalyticsPeriod): Promise<AdSlotMetrics[]> {
  const views = sum(buildSeries(period).map((p) => p.views));
  return Object.values(adSlots)
    .map((slot) => {
      const { reach, ctr } = adSlotCtrMock[slot.key];
      const impressions = Math.round(views * reach);
      return {
        key: slot.key,
        label: slot.label,
        impressions,
        clicks: Math.round(impressions * ctr),
      };
    })
    .sort((a, b) => b.impressions - a.impressions);
}

function buildSeries(period: AnalyticsPeriod): AnalyticsPoint[] {
  if (period === "hoje" || period === "24h") {
    const current =
      period === "hoje"
        ? hourlyViewsMock.filter((p) => Date.parse(p.at) >= TODAY_START.getTime())
        : hourlyViewsMock.slice(-24);
    const offset = hourlyViewsMock.length - current.length;
    return current.map((p, i) => ({
      at: p.at,
      views: p.views,
      // Mesmo horário 24 h antes (ontem até a mesma hora / 24 h anteriores).
      previous: hourlyViewsMock[offset + i - 24]?.views ?? 0,
    }));
  }
  const days = period === "7d" ? 7 : 30;
  const current = dailyViewsMock.slice(-days);
  const previous = dailyViewsMock.slice(-2 * days, -days);
  // Hoje ainda não terminou: o último dia usa a soma das horas até agora.
  const todaySoFar = sum(
    hourlyViewsMock.filter((p) => Date.parse(p.at) >= TODAY_START.getTime()).map((p) => p.views),
  );
  return current.map((p, i) => ({
    at: p.at,
    views: i === current.length - 1 ? todaySoFar : p.views,
    previous: previous[i]?.views ?? 0,
  }));
}

function totalsFor(views: number, published: number, factor: number): AnalyticsTotals {
  return {
    views,
    visitors: Math.round(views * 0.61 * factor),
    avgReadSeconds: Math.round(104 * factor),
    published,
  };
}

function shares(list: { key: string; label: string; share: number }[], total: number) {
  return list.map(({ key, label, share }) => ({ key, label, views: Math.round(total * share) }));
}

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);
