import { notFound } from "next/navigation";

import { SectionTabs } from "@/components/admin/section-tabs";
import { adminRoutes } from "@/config/admin-navigation";
import { can } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";

// Equipe e autores (FE-159). Acessos (convite, perfil, 2FA): só ADMIN (users.manage).
// Autores: ADMIN e EDITOR (authors.manage).
export default async function TeamLayout({ children }: LayoutProps<"/admin/equipe">) {
  const user = await getCurrentUser();
  if (!can(user.role, "authors.manage")) notFound();
  const tabs = [
    ...(can(user.role, "users.manage") ? [{ label: "Equipe", href: adminRoutes.team }] : []),
    { label: "Autores", href: adminRoutes.authors },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Equipe e autores</h1>
        <p className="text-sm text-muted-foreground">
          Quem acessa o painel e quem assina as matérias.
        </p>
      </div>
      <SectionTabs label="Equipe e autores" tabs={tabs} />
      {children}
    </div>
  );
}
