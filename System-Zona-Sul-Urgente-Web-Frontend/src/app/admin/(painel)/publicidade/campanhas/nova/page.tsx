import type { Metadata } from "next";

import { CampaignForm } from "@/components/admin/ads/campaign-form";
import { listAdvertisers } from "@/services/admin/ads-service";
import { getAdSlots } from "@/services/ad-service";
import { getCategories, getNeighborhoods } from "@/services/taxonomy-service";

export const metadata: Metadata = { title: "Nova campanha" };

export default async function NewCampaignPage() {
  const [advertisers, slots, categories, neighborhoods] = await Promise.all([
    listAdvertisers(),
    getAdSlots(),
    getCategories(),
    getNeighborhoods(),
  ]);
  return (
    <CampaignForm
      advertisers={advertisers.map((a) => ({ id: a.id, name: a.name }))}
      slots={slots.map((s) => ({ key: s.key, label: s.label, sizes: s.sizes }))}
      categories={categories.filter((c) => !c.parent).map((c) => ({ slug: c.slug, name: c.name }))}
      neighborhoods={neighborhoods.map((n) => ({ slug: n.slug, name: n.name }))}
    />
  );
}
