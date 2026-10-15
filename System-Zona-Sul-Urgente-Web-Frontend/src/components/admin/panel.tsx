import Link from "next/link";

import { cn } from "@/lib/utils";

// Bloco com título do painel (lista, tabela, gráfico). `empty` quando não há itens.
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-lg border bg-background shadow-xs", className)}>
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-heading text-base font-bold">{title}</h2>
        {action && (
          <Link href={action.href} className="text-sm font-medium text-brand-blue hover:underline">
            {action.label}
          </Link>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
