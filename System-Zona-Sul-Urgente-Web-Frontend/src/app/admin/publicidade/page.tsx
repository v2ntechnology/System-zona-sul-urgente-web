import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Publicidade" };

export default function Page() {
  return <ComingSoon title="Publicidade" item="FE-157" />;
}
