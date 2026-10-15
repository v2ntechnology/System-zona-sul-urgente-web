import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminHeader } from "@/components/admin/admin-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { BrandLogo } from "@/components/brand/brand-logo";
import { adminNav } from "@/config/admin-navigation";
import { can, roleLabels } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Zona Sul Urgente" },
  robots: { index: false, follow: false },
};

// Sem login ainda (BE-006), o painel NÃO pode ir ao ar aberto: em produção só aparece
// com ADMIN_PREVIEW=true NO BUILD (ex.: staging protegido por Cloudflare Access). Senão, 404.
// O valor é fixado no build pelo next.config (env), igual para todas as páginas do painel.
const adminEnabled = process.env.NODE_ENV !== "production" || process.env.ADMIN_PREVIEW === "true";

// Layout do painel (FE-151): isolado do layout público, menu filtrado por permissão (RBAC).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!adminEnabled) notFound();
  const user = await getCurrentUser();
  const items = adminNav.filter((item) => !item.permission || can(user.role, item.permission));

  return (
    <div className="flex min-h-screen flex-1">
      {/* Coluna azul de altura total; a barra em si fica fixa ao rolar. */}
      <div className="hidden w-60 shrink-0 bg-brand-blue-dark md:block">
        <aside className="sticky top-0 flex h-screen flex-col gap-6 p-4 text-white">
          <div className="flex items-center gap-2">
            <BrandLogo variant="masthead" className="text-[0.6rem]" />
            <span className="font-heading text-lg font-bold">Painel</span>
          </div>
          <AdminNav items={items} />
          <p className="mt-auto text-xs text-white/60">Dados de exemplo — sem backend conectado.</p>
        </aside>
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-muted/40">
        <AdminHeader items={items} user={{ name: user.name, roleLabel: roleLabels[user.role] }} />
        <main id="conteudo" className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
