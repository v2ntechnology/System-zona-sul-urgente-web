import { MegaphoneIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { campaignStatusLabel } from "@/components/admin/ads/campaign-status-badge";
import { CampaignsTable } from "@/components/admin/ads/campaigns-table";
import { KpiTile } from "@/components/admin/analytics/analytics-parts";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { StatCard } from "@/components/admin/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRoutes } from "@/config/admin-navigation";
import { campaignPeriodNow } from "@/lib/ads/period";
import {
  CAMPAIGN_STATUSES,
  countCampaignsByStatus,
  getAdsSummary,
  listCampaigns,
} from "@/services/admin/ads-service";
import { getAdSlots } from "@/services/ad-service";
import type { CampaignStatus } from "@/types/admin";

export const metadata: Metadata = { title: "Publicidade" };

const STATUSES = new Set<string>(CAMPAIGN_STATUSES);
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

// Campanhas (FE-157): indicadores de 7 dias, abas por status (?status=) e a lista.
export default function CampaignsPage({ searchParams }: PageProps<"/admin/publicidade">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] rounded-xl" />}>
      <Campaigns searchParams={searchParams} />
    </Suspense>
  );
}

type Params = Awaited<PageProps<"/admin/publicidade">["searchParams"]>;

async function Campaigns({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = raw && STATUSES.has(raw) ? (raw as CampaignStatus) : undefined;
  const [campaigns, counts, summary, slots] = await Promise.all([
    listCampaigns(status),
    countCampaignsByStatus(),
    getAdsSummary(),
    getAdSlots(),
  ]);
  const label = new Map(slots.map((s) => [s.key, s.label]));
  const ctr = summary.impressions ? summary.clicks / summary.impressions : 0;
  const prevCtr = summary.previous.impressions
    ? summary.previous.clicks / summary.previous.impressions
    : 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Campanhas no ar"
          value={summary.activeCampaigns}
          icon={<MegaphoneIcon className="size-4" />}
          href={`${adminRoutes.ads}?status=ACTIVE`}
          hint={
            summary.endingSoon > 0
              ? `${summary.endingSoon} termina${summary.endingSoon > 1 ? "m" : ""} em até 7 dias`
              : undefined
          }
        />
        <KpiTile
          label="Impressões (7 dias)"
          value={summary.impressions}
          previous={summary.previous.impressions}
          previousLabel="7 dias anteriores"
        />
        <KpiTile
          label="Cliques (7 dias)"
          value={summary.clicks}
          previous={summary.previous.clicks}
          previousLabel="7 dias anteriores"
        />
        <KpiTile
          label="CTR (7 dias)"
          value={ctr}
          display={percent.format(ctr)}
          previous={prevCtr}
          previousLabel="7 dias anteriores"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Filtrar por status"
          active={status ?? "ALL"}
          tabs={[
            { key: "ALL", label: "Todas", count: counts.ALL ?? 0, href: adminRoutes.ads },
            ...CAMPAIGN_STATUSES.map((s) => ({
              key: s,
              label: campaignStatusLabel(s),
              count: counts[s] ?? 0,
              href: `${adminRoutes.ads}?status=${s}`,
            })),
          ]}
        />
        <Link
          href={adminRoutes.newCampaign}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          <PlusIcon aria-hidden className="size-4" /> Nova campanha
        </Link>
      </div>

      {/* key: ao trocar o filtro, a lista recomeça (descarta o estado das simulações). */}
      <CampaignsTable
        key={status ?? "ALL"}
        rows={campaigns.map((c) => ({
          ...c,
          period: campaignPeriodNow(c.startsAt, c.endsAt),
          slotLabels: c.slots.map((k) => label.get(k) ?? k),
        }))}
      />
    </>
  );
}
