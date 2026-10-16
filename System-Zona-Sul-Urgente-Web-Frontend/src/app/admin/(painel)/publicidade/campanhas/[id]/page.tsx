import { ArrowUpRightIcon, MapPinIcon, NewspaperIcon } from "lucide-react";
import type { Metadata } from "next";
import { RemoteImage } from "@/components/media/remote-image";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CampaignStatusBadge } from "@/components/admin/ads/campaign-status-badge";
import { Panel } from "@/components/admin/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { campaignPeriodNow } from "@/lib/ads/period";
import { formatSize } from "@/lib/ads/validate";
import { formatCount } from "@/lib/chart";
import { getCampaign } from "@/services/admin/ads-service";
import { cn } from "@/lib/utils";
import { getAdSlots } from "@/services/ad-service";

export const metadata: Metadata = { title: "Campanha" };

const full = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

// Detalhe da campanha (FE-157): período, segmentação, meta de entrega e, por peça,
// a prévia no tamanho real proporcional e o desempenho (impressões, cliques, CTR).
export default function CampaignPage({ params }: PageProps<"/admin/publicidade/campanhas/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] rounded-xl" />}>
      <CampaignDetail params={params} />
    </Suspense>
  );
}

async function CampaignDetail({
  params,
}: {
  params: PageProps<"/admin/publicidade/campanhas/[id]">["params"];
}) {
  const { id } = await params;
  const [campaign, slots] = await Promise.all([getCampaign(id), getAdSlots()]);
  if (!campaign) notFound();
  const label = new Map(slots.map((s) => [s.key, s.label]));
  const period = campaignPeriodNow(campaign.startsAt, campaign.endsAt);
  const ctr = campaign.impressions ? campaign.clicks / campaign.impressions : 0;
  const goal = campaign.goalImpressions
    ? Math.min(1, campaign.impressions / campaign.goalImpressions)
    : null;
  const { categories, neighborhoods } = campaign.targeting;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CampaignStatusBadge status={campaign.status} />
          <span className="text-sm text-muted-foreground">{campaign.advertiser.name}</span>
        </div>
        <h2 className="font-heading text-headline font-bold">{campaign.name}</h2>
        <p className="text-sm text-muted-foreground">
          <span className="tabular-nums">{period.range}</span> · {period.hint}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          {categories.length === 0 && neighborhoods.length === 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-1">Site todo (sem segmentação)</span>
          ) : (
            <>
              {categories.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"
                >
                  <NewspaperIcon aria-hidden className="size-3" /> {c}
                </span>
              ))}
              {neighborhoods.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"
                >
                  <MapPinIcon aria-hidden className="size-3" /> {n}
                </span>
              ))}
            </>
          )}
        </div>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Impressões", formatCount(campaign.impressions)],
          ["Cliques", formatCount(campaign.clicks)],
          ["CTR", campaign.impressions ? percent.format(ctr) : "—"],
        ].map(([term, value]) => (
          <div
            key={term}
            className="flex flex-col gap-1.5 rounded-lg border bg-background p-4 shadow-xs"
          >
            <dt className="text-sm font-medium text-muted-foreground">{term}</dt>
            <dd className="text-3xl font-semibold tracking-tight">{value}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1.5 rounded-lg border bg-background p-4 shadow-xs">
          <dt className="text-sm font-medium text-muted-foreground">Meta de entrega</dt>
          {goal === null ? (
            <dd className="text-sm text-muted-foreground">Sem meta contratada</dd>
          ) : (
            <>
              <dd className="text-3xl font-semibold tracking-tight">{Math.round(goal * 100)}%</dd>
              <dd className="flex flex-col gap-1">
                {/* Medidor: entrega × meta (trilho no mesmo tom, mais claro). */}
                <span aria-hidden className="h-1.5 rounded-full bg-brand-sky-light">
                  <span
                    className="block h-full rounded-full bg-chart-1"
                    style={{ width: `${goal * 100}%` }}
                  />
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {full.format(campaign.impressions)} de {full.format(campaign.goalImpressions!)}
                </span>
              </dd>
            </>
          )}
        </div>
      </dl>

      <Panel title="Peças por posição">
        <ul
          className={cn("grid gap-px bg-border", campaign.creatives.length > 1 && "md:grid-cols-2")}
        >
          {campaign.creatives.map((creative) => {
            const cctr = creative.impressions ? creative.clicks / creative.impressions : 0;
            return (
              <li key={creative.id} className="flex flex-col gap-3 bg-background p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">{label.get(creative.slot)}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatSize(creative)}
                  </span>
                </div>
                {/* Prévia proporcional ao tamanho real da peça, sobre um fundo de "página". */}
                <div className="flex min-h-40 items-center justify-center rounded-lg bg-muted/60 p-4">
                  <div
                    className="relative w-full overflow-hidden rounded-sm shadow-sm ring-1 ring-border"
                    style={{
                      maxWidth: Math.min(creative.width, 420),
                      aspectRatio: `${creative.width} / ${creative.height}`,
                      maxHeight: 260,
                    }}
                  >
                    <RemoteImage
                      src={creative.imageUrl}
                      alt={creative.alt}
                      fill
                      sizes="420px"
                      className="object-cover"
                    />
                  </div>
                </div>
                <a
                  href={creative.clickUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 truncate text-xs font-medium text-brand-blue hover:underline"
                >
                  {new URL(creative.clickUrl).host}
                  <ArrowUpRightIcon aria-hidden className="size-3" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
                <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Impressões</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatCount(creative.impressions)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Cliques</dt>
                    <dd className="font-semibold tabular-nums">{formatCount(creative.clicks)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">CTR</dt>
                    <dd className="font-semibold tabular-nums">
                      {creative.impressions ? percent.format(cctr) : "—"}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
