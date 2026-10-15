import { SearchIcon } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { MainNav } from "@/components/layout/main-nav";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { routes } from "@/config/navigation";

// Header no padrão CNN (FE-007): barra azul com menu, logo, editorias e busca.
// Abaixo de lg as editorias descem para uma faixa branca rolável.
// A faixa de notícia urgente entra no FE-108.
export function SiteHeader() {
  return (
    <header>
      <div className="bg-masthead text-masthead-foreground">
        <div className="mx-auto flex max-w-site items-center gap-2 px-2 py-2.5 sm:px-4">
          <MobileMenu />
          <BrandLogo className="mr-4 text-[0.6rem] sm:text-xs" />
          <MainNav variant="bar" className="hidden lg:block" />
          <Link
            href={routes.search}
            aria-label="Buscar"
            className="ml-auto inline-flex size-10 items-center justify-center rounded-md hover:bg-white/10 focus-visible:outline-white"
          >
            <SearchIcon className="size-5" />
          </Link>
        </div>
      </div>
      <MainNav variant="strip" className="border-b lg:hidden" />
    </header>
  );
}
