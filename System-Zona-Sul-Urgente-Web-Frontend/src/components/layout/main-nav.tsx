"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { sections } from "@/config/navigation";
import { cn } from "@/lib/utils";

type MainNavProps = {
  className?: string;
  /** "bar": dentro da barra azul (desktop); "strip": faixa branca rolável (mobile). */
  variant: "bar" | "strip";
};

// Lista de editorias. Client só para marcar a página atual (aria-current).
export function MainNav({ className, variant }: MainNavProps) {
  const pathname = usePathname();

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
                  // Indicador da editoria atual: filete vermelho, como os acentos da CNN.
                  "aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2.5 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-brand-red",
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
