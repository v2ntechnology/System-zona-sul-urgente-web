import type { AdSlot, AdSlotKey, Advertisement } from "@/types/news";

import { mockId } from "@/mocks/taxonomy";

// Dados de exemplo (FE-009). Tamanhos no padrão IAB; o primeiro de cada slot reserva o espaço.
export const adSlots: Record<AdSlotKey, AdSlot> = {
  HOME_TOP: {
    key: "HOME_TOP",
    label: "Topo da home",
    sizes: [
      { width: 970, height: 250 },
      { width: 728, height: 90 },
      { width: 320, height: 100 },
    ],
  },
  HOME_MIDDLE: {
    key: "HOME_MIDDLE",
    label: "Meio da home",
    sizes: [
      { width: 728, height: 90 },
      { width: 300, height: 250 },
    ],
  },
  HOME_SIDEBAR: {
    key: "HOME_SIDEBAR",
    label: "Lateral da home",
    sizes: [
      { width: 300, height: 600 },
      { width: 300, height: 250 },
    ],
  },
  ARTICLE_TOP: {
    key: "ARTICLE_TOP",
    label: "Topo da matéria",
    sizes: [
      { width: 728, height: 90 },
      { width: 320, height: 100 },
    ],
  },
  ARTICLE_MIDDLE: {
    key: "ARTICLE_MIDDLE",
    label: "Meio da matéria",
    sizes: [{ width: 300, height: 250 }],
  },
  ARTICLE_BOTTOM: {
    key: "ARTICLE_BOTTOM",
    label: "Fim da matéria",
    sizes: [
      { width: 728, height: 90 },
      { width: 300, height: 250 },
    ],
  },
  CATEGORY_TOP: {
    key: "CATEGORY_TOP",
    label: "Topo da editoria",
    sizes: [
      { width: 728, height: 90 },
      { width: 320, height: 100 },
    ],
  },
  MOBILE_STICKY: {
    key: "MOBILE_STICKY",
    label: "Rodapé fixo (celular)",
    sizes: [{ width: 320, height: 50 }],
  },
};

// Venda direta de exemplo (anunciante fictício). Slots sem anúncio mostram o placeholder.
export const adsMock: Advertisement[] = [
  {
    id: mockId(20, 1),
    slot: "HOME_SIDEBAR",
    type: "DIRECT",
    advertiser: "Academia Orla Fit",
    image: {
      id: mockId(21, 1),
      url: "https://picsum.photos/seed/anuncio-orla-fit/300/600",
      width: 300,
      height: 600,
      alt: "Anúncio: Academia Orla Fit, primeira semana grátis",
    },
    clickUrl: "https://example.com/orla-fit",
    startsAt: "2026-10-01T00:00:00-03:00",
    endsAt: "2026-10-31T23:59:59-03:00",
  },
];
