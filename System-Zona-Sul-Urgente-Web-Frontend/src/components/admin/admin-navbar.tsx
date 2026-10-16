"use client";

import {
  BarChart3Icon,
  CameraIcon,
  ExternalLinkIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MegaphoneIcon,
  MoreHorizontalIcon,
  NewspaperIcon,
  PaletteIcon,
  PlusIcon,
  SquarePenIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";

import { logoutAction } from "@/app/admin/login/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { type AdminNavItem, adminRoutes } from "@/config/admin-navigation";
import { cn } from "@/lib/utils";

const icons = {
  dashboard: LayoutDashboardIcon,
  news: NewspaperIcon,
  new: SquarePenIcon,
  instagram: CameraIcon,
  taxonomy: FolderTreeIcon,
  analytics: BarChart3Icon,
  ads: MegaphoneIcon,
  users: UsersIcon,
  design: PaletteIcon,
};

type NavbarProps = {
  items: AdminNavItem[];
  newNews?: AdminNavItem;
  user: { name: string; roleLabel: string };
};

// Navegação do painel (decisão 2026-10-15): pílula no topo (desktop) e barra inferior fixa
// com "+" no meio (celular, como o app do Instagram). O destaque do item ativo lê a URL
// (usePathname), por isso fica em <Suspense>: rotas dinâmicas pré-renderizam sem destaque.
export function AdminNavbar(props: NavbarProps) {
  return (
    <Suspense fallback={<NavbarView {...props} />}>
      <ActiveNavbar {...props} />
    </Suspense>
  );
}

function ActiveNavbar(props: NavbarProps) {
  const pathname = usePathname();
  const candidates = [...props.items, ...(props.newNews ? [props.newNews] : [])];
  // Item mais específico que casa com a URL (/admin/noticias/nova → "Nova notícia").
  const active = candidates
    .filter(
      (i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(`${i.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  return <NavbarView {...props} active={active?.href} />;
}

const subscribeScroll = (onChange: () => void) => {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
};

function NavbarView({ items, newNews, user, active }: NavbarProps & { active?: string }) {
  const scrolled = useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > 8,
    () => false,
  );
  return (
    <>
      {/* No topo: barra colada na borda. Ao rolar: vira a pílula flutuante (desktop). */}
      <header
        data-scrolled={scrolled || undefined}
        className="group/nav sticky top-0 z-30 border-b bg-background/90 backdrop-blur transition-[padding] duration-200 motion-reduce:transition-none md:bg-background md:backdrop-blur-none md:data-scrolled:border-transparent md:data-scrolled:bg-transparent md:data-scrolled:px-3 md:data-scrolled:pt-3"
      >
        <div className="flex h-14 items-center gap-4 px-4 transition-[border-radius,box-shadow,padding] duration-200 motion-reduce:transition-none md:h-auto md:py-2 md:pr-4 md:pl-6 md:group-data-scrolled/nav:rounded-full md:group-data-scrolled/nav:bg-background/95 md:group-data-scrolled/nav:pr-2 md:group-data-scrolled/nav:pl-5 md:group-data-scrolled/nav:shadow-md md:group-data-scrolled/nav:ring-1 md:group-data-scrolled/nav:ring-border md:group-data-scrolled/nav:backdrop-blur">
          <Link href={adminRoutes.dashboard} className="flex shrink-0 items-center gap-2">
            <BrandLogo variant="masthead" className="text-[0.5rem]" asLink={false} />
            <span className="font-heading text-base font-bold text-brand-blue">Painel</span>
          </Link>

          <nav aria-label="Menu do painel" className="hidden min-w-0 flex-1 md:block">
            <ul className="flex items-center justify-center gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <PillLink item={item} current={item.href === active} />
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {newNews && (
              <Link
                href={newNews.href}
                aria-current={newNews.href === active ? "page" : undefined}
                className="hidden h-10 items-center gap-1.5 rounded-full bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-dark md:inline-flex"
              >
                <PlusIcon aria-hidden className="size-4" /> {newNews.label}
              </Link>
            )}
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <MobileTabBar items={items} newNews={newNews} active={active} />
    </>
  );
}

function PillLink({ item, current }: { item: AdminNavItem; current: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition",
        current
          ? "bg-brand-blue text-white shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {item.label}
      {item.badge ? (
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums",
            current ? "bg-white text-brand-blue" : "bg-brand-red text-white",
          )}
        >
          {item.badge}
          <span className="sr-only"> pendentes</span>
        </span>
      ) : null}
    </Link>
  );
}

function UserMenu({ user }: { user: NavbarProps["user"] }) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Conta de ${user.name}`}
        className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-muted lg:pr-3"
      >
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white"
        >
          {initials}
        </span>
        <span className="hidden flex-col items-start leading-tight lg:flex">
          <span className="text-sm font-semibold">{user.name}</span>
          <span className="text-xs text-muted-foreground">{user.roleLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col py-2">
            <span className="text-sm font-semibold text-foreground">{user.name}</span>
            <span className="text-xs font-normal">{user.roleLabel}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href="/" target="_blank" rel="noopener" />} className="py-2">
          <ExternalLinkIcon aria-hidden /> Ver o site
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={adminRoutes.designSystem} />} className="py-2">
          <PaletteIcon aria-hidden /> Design system
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Encerra a sessão na API e apaga o cookie (Server Action). */}
        <DropdownMenuItem onClick={() => logoutAction()} className="py-2">
          <LogOutIcon aria-hidden /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Celular: 2 itens, "+" no meio, 1 item e "Mais" (o resto abre numa folha de baixo). */
function MobileTabBar({
  items,
  newNews,
  active,
}: {
  items: AdminNavItem[];
  newNews?: AdminNavItem;
  active?: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const left = items.slice(0, 2);
  const right = items.slice(2, 3);
  const rest = items.slice(3);
  const restActive = rest.some((i) => i.href === active);

  return (
    <nav
      aria-label="Menu do painel"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {left.map((item) => (
          <li key={item.href}>
            <TabLink item={item} current={item.href === active} />
          </li>
        ))}
        <li className="flex justify-center">
          {newNews ? (
            <Link
              href={newNews.href}
              aria-label={newNews.label}
              aria-current={newNews.href === active ? "page" : undefined}
              className="flex size-12 items-center justify-center rounded-2xl bg-brand-red text-white shadow-md transition active:scale-95"
            >
              <PlusIcon aria-hidden className="size-6" strokeWidth={2.5} />
            </Link>
          ) : null}
        </li>
        {right.map((item) => (
          <li key={item.href}>
            <TabLink item={item} current={item.href === active} />
          </li>
        ))}
        {rest.length > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-current={restActive ? "page" : undefined}
              className={cn(tabClass, restActive && "text-brand-blue")}
            >
              <MoreHorizontalIcon aria-hidden className="size-6" />
              Mais
            </button>
          </li>
        )}
      </ul>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <SheetTitle className="px-4 pt-4 font-heading text-base font-bold">
            Mais opções
          </SheetTitle>
          <ul className="flex flex-col px-2">
            {[
              ...rest,
              {
                label: "Design system",
                href: adminRoutes.designSystem,
                icon: "design" as const,
              },
            ].map((item) => {
              const Icon = icons[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={item.href === active ? "page" : undefined}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-muted aria-[current=page]:text-brand-blue"
                  >
                    <Icon aria-hidden className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

const tabClass =
  "relative flex w-full flex-col items-center gap-0.5 text-[0.7rem] font-medium text-muted-foreground transition";

function TabLink({ item, current }: { item: AdminNavItem; current: boolean }) {
  const Icon = icons[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(tabClass, current && "text-brand-blue")}
    >
      <span className="relative">
        <Icon aria-hidden className="size-6" strokeWidth={current ? 2.25 : 1.75} />
        {item.badge ? (
          <span className="absolute -top-1.5 -right-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[0.6rem] font-bold text-white tabular-nums ring-2 ring-background">
            {item.badge}
            <span className="sr-only"> pendentes</span>
          </span>
        ) : null}
      </span>
      {item.label}
    </Link>
  );
}
