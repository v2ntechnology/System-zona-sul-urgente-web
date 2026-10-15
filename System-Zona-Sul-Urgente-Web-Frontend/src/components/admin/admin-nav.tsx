"use client";

import {
  BarChart3Icon,
  CameraIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  NewspaperIcon,
  PaletteIcon,
  SquarePenIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import type { AdminNavItem } from "@/config/admin-navigation";
import { cn } from "@/lib/utils";

const icons = {
  dashboard: LayoutDashboardIcon,
  news: NewspaperIcon,
  new: SquarePenIcon,
  instagram: CameraIcon,
  analytics: BarChart3Icon,
  ads: MegaphoneIcon,
  users: UsersIcon,
  design: PaletteIcon,
};

type NavProps = { items: AdminNavItem[]; onNavigate?: () => void };

// Itens do menu do painel, já filtrados por permissão no servidor. O destaque do item ativo
// depende da URL (usePathname), por isso fica em <Suspense>: rotas dinâmicas do painel
// (ex.: /admin/noticias/[id]) pré-renderizam o menu sem destaque e completam no navegador.
export function AdminNav(props: NavProps) {
  return (
    <Suspense fallback={<AdminNavList {...props} />}>
      <ActiveAdminNav {...props} />
    </Suspense>
  );
}

function ActiveAdminNav({ items, onNavigate }: NavProps) {
  const pathname = usePathname();
  // Item mais específico que casa com a URL (/admin/noticias/nova → "Nova notícia").
  const active = items
    .filter(
      (i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(`${i.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return <AdminNavList items={items} onNavigate={onNavigate} active={active} />;
}

function AdminNavList({ items, onNavigate, active }: NavProps & { active?: AdminNavItem }) {
  return (
    <nav aria-label="Menu do painel">
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const current = item === active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-white",
                  current && "bg-white/15 text-white",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {item.label}
                {current && (
                  <span aria-hidden className="ml-auto h-4 w-1 rounded-full bg-brand-red" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
