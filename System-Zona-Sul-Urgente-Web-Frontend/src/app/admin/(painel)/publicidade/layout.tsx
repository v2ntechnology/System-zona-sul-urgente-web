import { notFound } from "next/navigation";

import { AdsTabs } from "@/components/admin/ads/ads-tabs";
import { can } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";

// Publicidade — venda direta (FE-157): campanhas, anunciantes e posições. Só ADMIN e
// COMERCIAL (ads.manage); o menu já esconde, e a página recusa também.
export default async function AdsLayout({ children }: LayoutProps<"/admin/publicidade">) {
  const user = await getCurrentUser();
  if (!can(user.role, "ads.manage")) notFound();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Publicidade</h1>
        <p className="text-sm text-muted-foreground">
          Venda direta para o comércio local. Quando uma posição está sem campanha, o Google AdSense
          preenche.
        </p>
      </div>
      <AdsTabs />
      {children}
    </div>
  );
}
