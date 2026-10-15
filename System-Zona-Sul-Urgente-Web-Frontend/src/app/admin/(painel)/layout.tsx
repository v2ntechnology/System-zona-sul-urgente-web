import { Suspense } from "react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { adminNav, newNewsItem } from "@/config/admin-navigation";
import { can, roleLabels } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";
import { countInstagramPostsByStatus } from "@/services/admin/instagram-service";

// Layout do painel (FE-151): navbar em pílula no topo e, no celular, barra inferior como a
// do app do Instagram (decisão 2026-10-15). Itens filtrados por permissão (RBAC).
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const [user, igCounts] = await Promise.all([getCurrentUser(), countInstagramPostsByStatus()]);
  const pending = (igCounts.NEW ?? 0) + (igCounts.ERROR ?? 0) + (igCounts.CHANGED_AT_SOURCE ?? 0);
  const items = adminNav
    .filter((item) => !item.permission || can(user.role, item.permission))
    .map((item) => (item.icon === "instagram" && pending > 0 ? { ...item, badge: pending } : item));

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-muted/40">
      <AdminNavbar
        items={items}
        newNews={can(user.role, "news.create") ? newNewsItem : undefined}
        user={{ name: user.name, roleLabel: roleLabels[user.role] }}
      />
      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-3 px-4 pt-4 pb-28 sm:px-6 md:pb-10"
      >
        {/* A trilha depende da URL: em <Suspense> para rotas dinâmicas pré-renderizarem. */}
        <Suspense fallback={null}>
          <AdminBreadcrumb />
        </Suspense>
        <div>{children}</div>
      </main>
    </div>
  );
}
