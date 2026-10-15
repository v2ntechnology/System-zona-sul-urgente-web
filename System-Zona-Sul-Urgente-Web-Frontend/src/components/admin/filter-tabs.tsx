import Link from "next/link";

import { cn } from "@/lib/utils";

export type FilterTab = { key: string; label: string; count: number; href: string };

// Abas de filtro com contagem (status de notícias, fila do Instagram). Links na URL:
// recarregar ou compartilhar mantém o filtro.
export function FilterTabs({
  label,
  tabs,
  active,
}: {
  label: string;
  tabs: FilterTab[];
  active: string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 [scrollbar-width:none] overflow-x-auto">
      <ul className="flex gap-1 px-1">
        {tabs.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
                  current
                    ? "bg-brand-blue text-white"
                    : "bg-background text-muted-foreground ring-1 ring-border hover:text-foreground",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    current ? "bg-white/20" : "bg-muted",
                  )}
                >
                  {tab.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
