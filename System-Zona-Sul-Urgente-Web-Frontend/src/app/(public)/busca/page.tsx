import type { Metadata } from "next";

import { SearchForm } from "@/components/layout/search-form";

export const metadata: Metadata = {
  title: "Busca",
  robots: { index: false, follow: true },
};

// Casca da busca: o formulário já envia ?q=…; resultados e filtros entram no FE-106.
export default function SearchPage() {
  return (
    <section className="mx-auto flex w-full max-w-reading flex-col gap-4">
      <h1 className="text-headline">Buscar notícias</h1>
      <SearchForm autoFocus />
    </section>
  );
}
