import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Editar notícia" };

export default function Page() {
  return <ComingSoon title="Editar notícia" item="FE-154" />;
}
