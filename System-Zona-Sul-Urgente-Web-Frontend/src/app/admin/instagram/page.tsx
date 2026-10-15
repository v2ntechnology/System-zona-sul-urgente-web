import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Importações do Instagram" };

export default function Page() {
  return <ComingSoon title="Importações do Instagram" item="FE-155" />;
}
