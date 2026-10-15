import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Nova notícia" };

export default function Page() {
  return <ComingSoon title="Nova notícia" item="FE-154" />;
}
