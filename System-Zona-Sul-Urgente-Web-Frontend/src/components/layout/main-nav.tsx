"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSections } from "@/components/layout/sections-context";
import { cn } from "@/lib/utils";

type MainNavProps = {
  className?: string;
  /** "bar": dentro da barra azul (desktop); "strip": faixa branca rolável (mobile). */
  variant: "bar" | "strip";
};

// Lista de editorias. Client só para marcar a página atual (aria-current).
export function MainNav({ className, variant }: MainNavProps) {
  const pathname = usePathname();
  const sections = useSections().filter((s) => s.inBar);

  return (
    <nav aria-label="Editorias" className={className}>
      <ul
        className={cn(
          "flex items-center",
          variant === "bar" ? "gap-1" : "[scrollbar-width:none] gap-5 overflow-x-auto px-4",
        )}
      >
        {sections.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative block text-sm font-medium whitespace-nowrap",
                  variant === "bar"
                    ? "rounded-md px-2.5 py-2 text-masthead-foreground/90 hover:bg-white/10 hover:text-white focus-visible:outline-white aria-[current=page]:text-white"
                    : "py-3 text-foreground hover:text-brand-blue aria-[current=page]:text-brand-blue",
                  // Filete vermelho que cresce do centro no hover e fica fixo na editoria atual.
                  "after:absolute after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-brand-red after:transition-transform after:duration-200 hover:after:scale-x-100 aria-[current=page]:after:scale-x-100 motion-reduce:after:transition-none",
                  variant === "bar" ? "after:inset-x-2.5" : "after:inset-x-0",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
