import { notFound } from "next/navigation";

import { SectionTabs } from "@/components/admin/section-tabs";
import { adminRoutes } from "@/config/admin-navigation";
import { can } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";

// Editorias e tópicos (FE-158). Tópicos: ADMIN, EDITOR e REPÓRTER (tags.manage);
// editorias: só ADMIN e EDITOR (taxonomy.manage).
export default async function TaxonomyLayout({ children }: LayoutProps<"/admin/editorias">) {
  const user = await getCurrentUser();
  if (!can(user.role, "tags.manage")) notFound();
  const tabs = [
    ...(can(user.role, "taxonomy.manage")
      ? [{ label: "Editorias", href: adminRoutes.taxonomy }]
      : []),
    { label: "Tópicos", href: adminRoutes.tags },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Editorias e tópicos</h1>
        <p className="text-sm text-muted-foreground">
          O que você muda aqui vale para o menu do site, as páginas de editoria e o editor de
          notícias.
        </p>
      </div>
      <SectionTabs label="Editorias e tópicos" tabs={tabs} />
      {children}
    </div>
  );
}
