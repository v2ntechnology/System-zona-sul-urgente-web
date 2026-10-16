import { describe, expect, it } from "vitest";

import {
  countCampaignsByStatus,
  getCampaign,
  getSlotsOverview,
  listAdvertisers,
  listCampaigns,
} from "@/services/admin/ads-service";

describe("ads-service", () => {
  it("lista ativas primeiro e filtra por status", async () => {
    const all = await listCampaigns();
    expect(all[0].status).toBe("ACTIVE");
    const paused = await listCampaigns("PAUSED");
    expect(paused.every((c) => c.status === "PAUSED")).toBe(true);
    const counts = await countCampaignsByStatus();
    expect(counts.ALL).toBe(all.length);
  });

  it("campanha tem um criativo por posição, no tamanho aceito, e soma as métricas", async () => {
    const [first] = await listCampaigns("ACTIVE");
    const campaign = await getCampaign(first.id);
    expect(campaign?.creatives.map((c) => c.slot)).toEqual(campaign?.slots);
    expect(campaign?.impressions).toBe(campaign?.creatives.reduce((s, c) => s + c.impressions, 0));
    expect(Date.parse(campaign!.startsAt)).toBeLessThan(Date.parse(campaign!.endsAt));
    expect(await getCampaign("nao-existe")).toBeNull();
  });

  it("posições: campanha ativa ocupa; sem ela, AdSense ou vazio", async () => {
    const slots = await getSlotsOverview();
    expect(slots).toHaveLength(8);
    expect(slots.find((s) => s.key === "HOME_SIDEBAR")?.campaign).toBeDefined();
    expect(slots.find((s) => s.key === "HOME_MIDDLE")?.campaign).toBeUndefined(); // pausada
  });

  it("anunciantes contam campanhas", async () => {
    const advertisers = await listAdvertisers();
    expect(advertisers.find((a) => a.name === "Academia Orla Fit")?.totalCampaigns).toBe(2);
  });
});
