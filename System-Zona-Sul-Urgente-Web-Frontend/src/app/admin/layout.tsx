import type { Metadata } from "next";

// O painel nunca deve ser indexado. Autenticação e RBAC entram com o backend;
// esta casca só isola o layout do admin do layout público (FE-151).
export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1">
      <aside className="hidden w-60 border-r bg-sidebar p-4 text-sidebar-foreground md:block">
        <span className="font-semibold">Painel</span>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
