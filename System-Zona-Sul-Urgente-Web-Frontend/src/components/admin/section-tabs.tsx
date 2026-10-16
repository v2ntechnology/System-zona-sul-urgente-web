"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

export type SectionTab = { label: string; href: string };

// Abas de uma seção do painel (Publicidade, Editorias). O destaque lê a URL: fica em
// <Suspense> para rotas dinâmicas pré-renderizarem.
export function SectionTabs({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  return (
    <Suspense fallback={<TabsList label={label} tabs={tabs} />}>
      <ActiveTabs label={label} tabs={tabs} />
    </Suspense>
  );
}

function ActiveTabs({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  const pathname = usePathname();
  const active =
    tabs
      .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? tabs[0]?.href;
  return <TabsList label={label} tabs={tabs} active={active} />;
}

function TabsList({ label, tabs, active }: { label: string; tabs: SectionTab[]; active?: string }) {
  return (
    <nav aria-label={label} className="border-b">
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
