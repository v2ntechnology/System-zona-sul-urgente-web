import { describe, expect, it } from "vitest";

import { getAdMetrics, getAnalytics, parsePeriod } from "@/services/admin/analytics-service";

describe("analytics-service", () => {
  it("período inválido cai em hoje", () => {
    expect(parsePeriod("xyz")).toBe("hoje");
    expect(parsePeriod(undefined)).toBe("hoje");
    expect(parsePeriod("7d")).toBe("7d");
  });

  it("hoje vai por hora até agora (15h) e compara com ontem na mesma hora", async () => {
    const report = await getAnalytics("hoje");
    expect(report.granularity).toBe("hour");
    expect(report.series).toHaveLength(15);
    expect(report.series.every((p) => p.previous > 0)).toBe(true);
  });

  it("7 e 30 dias vão por dia; totais batem com a série", async () => {
    for (const [period, days] of [
      ["7d", 7],
      ["30d", 30],
    ] as const) {
      const report = await getAnalytics(period);
      expect(report.granularity).toBe("day");
      expect(report.series).toHaveLength(days);
      expect(report.totals.views).toBe(report.series.reduce((s, p) => s + p.views, 0));
    }
  });

  it("fatias somam perto do total e rankings vêm ordenados", async () => {
    const report = await getAnalytics("24h");
    const sources = report.sources.reduce((s, i) => s + i.views, 0);
    expect(Math.abs(sources - report.totals.views)).toBeLessThan(10);
    const views = report.topNews.map((n) => n.views);
    expect(views).toEqual([...views].sort((a, b) => b - a));
  });

  it("CTR de anúncios fica numa faixa plausível", async () => {
    const ads = await getAdMetrics("7d");
    expect(ads.length).toBe(8);
    for (const slot of ads) expect(slot.clicks / slot.impressions).toBeLessThan(0.02);
  });
});
