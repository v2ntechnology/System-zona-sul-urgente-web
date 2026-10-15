import { MessageCircleIcon, SearchIcon } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { MainNav } from "@/components/layout/main-nav";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SectionLabel } from "@/components/layout/section-label";
import { BreakingTicker } from "@/components/news/breaking-ticker";
import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";

// Header no padrão CNN (FE-007): barra azul fixa no topo, que encolhe e ganha sombra
// ao rolar (CSS scroll-driven, ver .masthead-bar em globals.css). Abaixo dela, a faixa
// de editorias (mobile) e a faixa de urgentes rolam junto com a página.
export function SiteHeader() {
  return (
    <>
      <header className="masthead-bar group/masthead sticky top-0 z-40 bg-masthead text-masthead-foreground">
        <div className="mx-auto flex max-w-site items-center gap-2 px-2 py-2.5 sm:px-4">
          <MobileMenu />
          <BrandLogo className="masthead-logo mr-3 shrink-0 text-[0.6rem] sm:text-xs" />
          <SectionLabel />
          <MainNav variant="bar" className="hidden lg:block" />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <a
              href={siteConfig.reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Envie sua notícia pelo WhatsApp"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-brand-red-dark px-3 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition hover:-translate-y-px hover:shadow-md focus-visible:outline-white sm:px-4"
            >
              <MessageCircleIcon className="size-4" aria-hidden />
              {/* Texto curto onde a barra divide espaço (celular e lg); no celular, com o nome
                  da editoria ao lado do logo, fica só o ícone. */}
              <span className="group-has-[[data-section-label]]/masthead:max-sm:hidden sm:max-lg:hidden xl:hidden">
                Envie
              </span>
              <span className="hidden whitespace-nowrap sm:max-lg:inline xl:inline">
                Envie sua notícia
              </span>
            </a>
            <Link
              href={routes.search}
              aria-label="Buscar"
              className="inline-flex size-10 items-center justify-center rounded-md hover:bg-white/10 focus-visible:outline-white"
            >
              <SearchIcon className="size-5" />
            </Link>
          </div>
        </div>
        {/* Filete em duas cores do logo (azul-claro | vermelho), com corte seco. */}
        <div
          aria-hidden
          className="h-0.75 bg-linear-to-r from-brand-sky from-70% to-brand-red to-70%"
        />
      </header>
      <MainNav variant="strip" className="border-b lg:hidden" />
      <BreakingTicker />
    </>
  );
}
