import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Usuários" };

export default function Page() {
  return <ComingSoon title="Equipe e autores" item="FE-159" />;
}
