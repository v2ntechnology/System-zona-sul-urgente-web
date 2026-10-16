"use client";

import { createContext, useContext } from "react";

import type { SiteSection } from "@/config/navigation";

// Editorias do menu, carregadas uma vez no layout público (servidor) e lidas pelas partes
// do cabeçalho que rodam no navegador (barra, menu ☰, nome da editoria ao lado do logo).
const SectionsContext = createContext<SiteSection[]>([]);

export function SectionsProvider({
  sections,
  children,
}: {
  sections: SiteSection[];
  children: React.ReactNode;
}) {
  return <SectionsContext value={sections}>{children}</SectionsContext>;
}

export const useSections = () => useContext(SectionsContext);
