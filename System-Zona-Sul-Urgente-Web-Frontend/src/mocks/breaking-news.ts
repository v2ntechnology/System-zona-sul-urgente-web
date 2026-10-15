import type { BreakingNews } from "@/types/news";

// Dados de exemplo (FE-009). Nunca importar em componentes: use os services.
export const breakingNewsMock: BreakingNews[] = [
  {
    id: "0192a1b2-0001-7000-8000-000000000001",
    slug: "temporal-alaga-ruas-de-copacabana-e-botafogo",
    title: "Temporal alaga ruas de Copacabana e Botafogo; Defesa Civil emite alerta",
    publishedAt: "2026-10-15T14:32:00-03:00",
  },
  {
    id: "0192a1b2-0001-7000-8000-000000000002",
    slug: "tunel-reboucas-tem-faixa-fechada-apos-acidente",
    title: "Túnel Rebouças tem faixa fechada após acidente no sentido Lagoa",
    publishedAt: "2026-10-15T14:05:00-03:00",
  },
  {
    id: "0192a1b2-0001-7000-8000-000000000003",
    slug: "falta-de-luz-atinge-parte-do-leblon",
    title: "Falta de luz atinge parte do Leblon; concessionária promete religar até 18h",
    publishedAt: "2026-10-15T13:40:00-03:00",
  },
];
