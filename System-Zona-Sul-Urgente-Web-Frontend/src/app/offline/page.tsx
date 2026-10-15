import type { Metadata } from "next";

import { BrandLogo } from "@/components/brand/brand-logo";

export const metadata: Metadata = {
  title: "Sem conexão",
  robots: { index: false, follow: false },
};

// Página mostrada pelo service worker quando a navegação falha por falta de internet.
// Autossuficiente: não depende de dados nem de imagens externas.
export default function OfflinePage() {
  return (
    <main
      id="conteudo"
      className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center"
    >
      <BrandLogo variant="light" className="text-sm" />
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-headline">Você está sem internet</h1>
        <p className="text-muted-foreground">
          Assim que a conexão voltar, recarregue a página para ver as últimas notícias da Zona Sul.
        </p>
      </div>
      {/* Link comum (não <Link>): força um carregamento completo quando a rede voltar. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarga completa intencional */}
      <a
        href="/"
        className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-brand-blue-dark"
      >
        Tentar de novo
      </a>
    </main>
  );
}
