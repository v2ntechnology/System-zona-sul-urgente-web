import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Analytics" };

export default function Page() {
  return <ComingSoon title="Analytics" item="FE-156" />;
}
