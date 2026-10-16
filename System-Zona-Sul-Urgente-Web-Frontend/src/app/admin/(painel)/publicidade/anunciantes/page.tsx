import type { Metadata } from "next";

import { AdvertisersView } from "@/components/admin/ads/advertisers-view";
import { listAdvertisers } from "@/services/admin/ads-service";

export const metadata: Metadata = { title: "Anunciantes" };

export default async function AdvertisersPage() {
  return <AdvertisersView advertisers={await listAdvertisers()} />;
}
