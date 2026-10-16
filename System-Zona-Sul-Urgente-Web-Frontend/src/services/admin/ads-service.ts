import {
  adSlots,
  advertisersMock,
  campaignsMock,
  slotPagesMock,
  type CampaignMock,
} from "@/mocks/ads";
import { MOCK_NOW } from "@/mocks/news";
import { findCategory, findNeighborhood, mockId } from "@/mocks/taxonomy";
import { getAdMetrics } from "@/services/admin/analytics-service";
import type { AdSlotOverview, Advertiser, Campaign, CampaignStatus } from "@/types/admin";

// Publicidade — venda direta (FE-157). Hoje sobre mocks; depois GET/POST
// /api/v1/admin/ads/{advertisers,campaigns,slots}. Exige ads.manage (ADMIN, COMERCIAL).

/** Ordem das abas: o que está no ar primeiro. */
export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "ACTIVE",
  "SCHEDULED",
  "PAUSED",
  "DRAFT",
  "ENDED",
];

const DAY = 86_400_000;

export async function listCampaigns(status?: CampaignStatus): Promise<Campaign[]> {
  return campaignsMock
    .map(toCampaign)
    .filter((c) => !status || c.status === status)
    .sort(
      (a, b) =>
        CAMPAIGN_STATUSES.indexOf(a.status) - CAMPAIGN_STATUSES.indexOf(b.status) ||
        a.endsAt.localeCompare(b.endsAt),
    );
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const mock = campaignsMock.find((c) => campaignId(c.n) === id);
  return mock ? toCampaign(mock) : null;
}

export async function countCampaignsByStatus(): Promise<Record<string, number>> {
  const counts: Record<string, number> = { ALL: campaignsMock.length };
  for (const c of campaignsMock) counts[c.status] = (counts[c.status] ?? 0) + 1;
  return counts;
}

export async function listAdvertisers(): Promise<Advertiser[]> {
  return advertisersMock.map(([name, document, contactName, email, phone, createdDaysAgo], i) => {
    const own = campaignsMock.filter((c) => c.advertiser === i);
    return {
      id: advertiserId(i),
      name,
      document,
      contactName,
      email,
      phone,
      activeCampaigns: own.filter((c) => c.status === "ACTIVE").length,
      totalCampaigns: own.length,
      createdAt: new Date(MOCK_NOW.getTime() - createdDaysAgo * DAY).toISOString(),
    };
  });
}

/** Quem ocupa cada posição hoje (campanha ativa ou AdSense) e o desempenho de 7 dias. */
export async function getSlotsOverview(): Promise<AdSlotOverview[]> {
  const metrics = await getAdMetrics("7d");
  const active = campaignsMock.filter((c) => c.status === "ACTIVE");
  return Object.values(adSlots).map((slot) => {
    const owner = active.find((c) => c.slots.includes(slot.key));
    const m = metrics.find((x) => x.key === slot.key);
    return {
      key: slot.key,
      label: slot.label,
      sizes: slot.sizes,
      page: slotPagesMock[slot.key],
      campaign: owner && {
        id: campaignId(owner.n),
        name: owner.name,
        advertiser: advertisersMock[owner.advertiser][0],
      },
      // Fim da matéria fica sem AdSense de propósito (leitura mais limpa no fim do texto).
      fallback: slot.key === "ARTICLE_BOTTOM" ? "EMPTY" : "ADSENSE",
      impressions7d: m?.impressions ?? 0,
      clicks7d: m?.clicks ?? 0,
    };
  });
}

/** Indicadores do topo (7 dias, com o período anterior para comparar). */
export async function getAdsSummary() {
  const metrics = await getAdMetrics("7d");
  const impressions = metrics.reduce((s, m) => s + m.impressions, 0);
  const clicks = metrics.reduce((s, m) => s + m.clicks, 0);
  return {
    activeCampaigns: campaignsMock.filter((c) => c.status === "ACTIVE").length,
    endingSoon: campaignsMock.filter(
      (c) => c.status === "ACTIVE" && c.startsInDays + c.durationDays <= 7,
    ).length,
    impressions,
    clicks,
    previous: { impressions: Math.round(impressions * 0.91), clicks: Math.round(clicks * 0.87) },
  };
}

const campaignId = (n: number) => mockId(22, n);
const advertiserId = (i: number) => mockId(23, i + 1);

function toCampaign(c: CampaignMock): Campaign {
  const start = new Date(MOCK_NOW.getTime() + c.startsInDays * DAY);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + c.durationDays * DAY - 1000);
  const creatives = c.slots.map((key, i) => {
    const size = adSlots[key].sizes[0];
    const [impressions, clicks] = c.delivered?.[i] ?? [0, 0];
    return {
      id: mockId(24, c.n * 10 + i),
      slot: key,
      imageUrl: `https://picsum.photos/seed/campanha-${c.n}-${i}/${size.width}/${size.height}`,
      width: size.width,
      height: size.height,
      alt: `Anúncio: ${advertisersMock[c.advertiser][0]} — ${c.name}`,
      clickUrl: `https://${advertisersMock[c.advertiser][3].split("@")[1]}/?utm_source=zonasulurgente&utm_campaign=c${c.n}`,
      impressions,
      clicks,
    };
  });
  return {
    id: campaignId(c.n),
    name: c.name,
    advertiser: { id: advertiserId(c.advertiser), name: advertisersMock[c.advertiser][0] },
    status: c.status,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    slots: c.slots,
    targeting: {
      categories: (c.categories ?? []).map((s) => findCategory(s).name),
      neighborhoods: (c.neighborhoods ?? []).map((s) => findNeighborhood(s).name),
    },
    creatives,
    impressions: creatives.reduce((s, x) => s + x.impressions, 0),
    clicks: creatives.reduce((s, x) => s + x.clicks, 0),
    goalImpressions: c.goalImpressions,
  };
}
