import { SectionTabs } from "@/components/admin/section-tabs";
import { adminRoutes } from "@/config/admin-navigation";

export function AdsTabs() {
  return (
    <SectionTabs
      label="Seções de publicidade"
      tabs={[
        { label: "Campanhas", href: adminRoutes.ads },
        { label: "Anunciantes", href: adminRoutes.advertisers },
        { label: "Posições", href: adminRoutes.adSlots },
      ]}
    />
  );
}
