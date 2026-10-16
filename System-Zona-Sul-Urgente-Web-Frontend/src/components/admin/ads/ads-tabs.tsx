"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import { adminRoutes } from "@/config/admin-navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Campanhas", href: adminRoutes.ads },
  { label: "Anunciantes", href: adminRoutes.advertisers },
  { label: "Posições", href: adminRoutes.adSlots },
];

// Abas da seção de publicidade. O destaque lê a URL: fica em <Suspense> (rotas dinâmicas).
export function AdsTabs() {
  return (
    <Suspense fallback={<TabsList />}>
      <ActiveTabs />
    </Suspense>
  );
}

function ActiveTabs() {
  const pathname = usePathname();
  const active =
    tabs
      .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? adminRoutes.ads;
  return <TabsList active={active} />;
}

function TabsList({ active }: { active?: string }) {
  return (
    <nav aria-label="Seções de publicidade" className="border-b">
      <ul className="-mb-px flex gap-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.href === active ? "page" : undefined}
              className={cn(
                "inline-flex border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition",
                tab.href === active
                  ? "border-brand-red text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
