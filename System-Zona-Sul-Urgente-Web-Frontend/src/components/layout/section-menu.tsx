"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { allSections } from "@/config/navigation";
import { sectionStyle } from "@/lib/section-color";
import { cn } from "@/lib/utils";

// Lista de editorias do menu ☰ no estilo CNN: faixa na cor da editoria à esquerda,
// rótulo em negrito e seta ▸ que expande as subeditorias.
export function SectionMenu({ onNavigate }: { onNavigate: () => void }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <nav aria-label="Todas as editorias">
      <ul className="flex flex-col">
        {allSections.map((section) => {
          const expanded = open === section.slug;
          const panelId = `submenu-${section.slug}`;
          return (
            <li key={section.slug} style={sectionStyle({ slug: section.slug })}>
              <div className="flex items-stretch border-l-[6px] border-[color:var(--section)] hover:bg-muted">
                <Link
                  href={section.href}
                  onClick={onNavigate}
                  className="flex-1 px-4 py-3 font-semibold hover:text-[color:var(--section)]"
                >
                  {section.label}
                </Link>
                {section.children && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    aria-label={`${expanded ? "Fechar" : "Abrir"} subeditorias de ${section.label}`}
                    onClick={() => setOpen(expanded ? null : section.slug)}
                    className="px-4 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRightIcon
                      aria-hidden
                      className={cn(
                        "size-4 transition-transform motion-reduce:transition-none",
                        expanded && "rotate-90",
                      )}
                    />
                  </button>
                )}
              </div>
              {section.children && expanded && (
                <ul
                  id={panelId}
                  className="border-l-[6px] border-[color:var(--section)]/40 bg-muted/60"
                >
                  {section.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        onClick={onNavigate}
                        className="block py-2.5 pr-4 pl-8 text-sm hover:text-[color:var(--section)]"
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
