"use client";

import { ChevronRightIcon, ExternalLinkIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { type AdminNavItem, adminSegmentLabels } from "@/config/admin-navigation";

type AdminHeaderProps = {
  items: AdminNavItem[];
  user: { name: string; roleLabel: string };
};

// Cabeçalho do painel: menu (celular), trilha, "Ver site" e usuário logado.
export function AdminHeader({ items, user }: AdminHeaderProps) {
  const [open, setOpen] = useState(false);
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Abrir menu do painel"
          className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted md:hidden"
        >
          <MenuIcon className="size-5" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="gap-0 bg-brand-blue-dark p-4 text-white [&>[data-slot=sheet-close]]:text-white"
        >
          <SheetTitle className="sr-only">Menu do painel</SheetTitle>
          <div className="mb-6">
            <BrandLogo variant="masthead" className="text-xs" asLink={false} />
          </div>
          <AdminNav items={items} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        {/* A trilha depende da URL: em <Suspense> para rotas dinâmicas pré-renderizarem. */}
        <Suspense fallback={null}>
          <AdminBreadcrumb />
        </Suspense>
      </div>

      <Link
        href="/"
        target="_blank"
        className="hidden items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline sm:inline-flex"
      >
        Ver site
        <ExternalLinkIcon aria-hidden className="size-3.5" />
      </Link>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white"
        >
          {initials}
        </span>
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="text-sm font-semibold">{user.name}</span>
          <span className="text-xs text-muted-foreground">{user.roleLabel}</span>
        </span>
      </div>
    </header>
  );
}

function AdminBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, i) => ({
    label: adminSegmentLabels[segment] ?? "Editar",
    href: `/${segments.slice(0, i + 1).join("/")}`,
  }));
  return (
    <nav aria-label="Você está em">
      <ol className="flex items-center gap-1 truncate text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon aria-hidden className="size-3.5" />}
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="font-semibold text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground hover:underline">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
