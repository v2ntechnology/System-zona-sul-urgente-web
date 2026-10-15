"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { SearchForm } from "@/components/layout/search-form";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { allSections, institutional, neighborhoods, type NavItem } from "@/config/navigation";
import { siteConfig } from "@/config/site";

// Menu completo (☰), aberto pela esquerda como na CNN. Disponível em todas as larguras:
// no desktop complementa a barra com bairros e links institucionais.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  // Foco inicial no topo da gaveta, não na busca: no celular isso abriria o teclado sozinho.
  const topRef = useRef<HTMLDivElement>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menu"
            className="text-masthead-foreground hover:bg-white/10 hover:text-white focus-visible:outline-white"
          />
        }
      >
        <MenuIcon className="size-6" />
      </SheetTrigger>

      <SheetContent
        side="left"
        initialFocus={topRef}
        // X de fechar fica sobre a faixa azul: branco para ter contraste.
        className="gap-0 overflow-y-auto p-0 [&>[data-slot=sheet-close]]:text-white [&>[data-slot=sheet-close]]:hover:bg-white/10"
      >
        <div ref={topRef} tabIndex={-1} className="bg-masthead p-4 outline-none">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <BrandLogo className="text-xs" asLink={false} />
        </div>

        <div className="flex flex-col gap-6 p-4">
          <SearchForm />

          <MenuGroup title="Editorias" items={allSections} onNavigate={close} />
          <MenuGroup title="Bairros" items={neighborhoods} onNavigate={close} columns />
          <MenuGroup title="Institucional" items={institutional} onNavigate={close} muted />

          <div className="flex flex-col gap-2 border-t pt-4 text-sm">
            <a
              href={siteConfig.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-blue hover:underline"
            >
              Instagram @zonasulurgente
            </a>
            {siteConfig.whatsappUrl && (
              <a
                href={siteConfig.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-blue hover:underline"
              >
                Canal no WhatsApp
              </a>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type MenuGroupProps = {
  title: string;
  items: (NavItem & { children?: NavItem[] })[];
  onNavigate: () => void;
  columns?: boolean;
  muted?: boolean;
};

function MenuGroup({ title, items, onNavigate, columns, muted }: MenuGroupProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label font-bold text-kicker uppercase">{title}</h2>
      <ul className={columns ? "grid grid-cols-2 gap-x-4" : "flex flex-col"}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={
                muted
                  ? "block py-1.5 text-sm text-muted-foreground hover:text-foreground"
                  : "block py-1.5 font-medium hover:text-brand-blue"
              }
            >
              {item.label}
            </Link>
            {item.children && (
              <ul className="mb-1 ml-3 border-l pl-3">
                {item.children.map((child) => (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      className="block py-1 text-sm text-muted-foreground hover:text-brand-blue"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
