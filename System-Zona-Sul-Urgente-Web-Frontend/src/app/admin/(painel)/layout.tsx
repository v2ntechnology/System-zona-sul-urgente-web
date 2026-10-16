import { Suspense } from "react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { adminNav, newNewsItem } from "@/config/admin-navigation";
import { can, roleLabels } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";
import { countInstagramPostsByStatus } from "@/services/admin/instagram-service";

// Layout do painel (FE-151): navbar em pílula no topo e, no celular, barra inferior como a
// do app do Instagram (decisão 2026-10-15). Itens filtrados por permissão (RBAC).
// Tudo depende de quem está logado (cookie de sessão, BE-006): fica num único <Suspense>,
// exigência do Cache Components para ler cookies — a moldura vazia aparece na hora.
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-muted/40">
      <Suspense fallback={<PainelSkeleton />}>
        <Painel>{children}</Painel>
      </Suspense>
    </div>
  );
}

async function Painel({ children }: { children: React.ReactNode }) {
  const [user, igCounts] = await Promise.all([getCurrentUser(), countInstagramPostsByStatus()]);
  const pending = (igCounts.NEW ?? 0) + (igCounts.ERROR ?? 0) + (igCounts.CHANGED_AT_SOURCE ?? 0);
  const items = adminNav
    .filter((item) => !item.permission || can(user.role, item.permission))
    .map((item) => (item.icon === "instagram" && pending > 0 ? { ...item, badge: pending } : item));

  return (
    <>
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
    </>
  );
}

function PainelSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando o painel" className="flex flex-col">
      <div className="h-14 border-b bg-background" />
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 pt-6 sm:px-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
