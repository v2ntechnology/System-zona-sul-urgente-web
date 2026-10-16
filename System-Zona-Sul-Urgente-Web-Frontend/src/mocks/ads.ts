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

// ---------------------------------------------------------------- painel comercial (FE-157)
// Anunciantes e campanhas FICTÍCIOS de exemplo (venda direta local).

export const advertisersMock = [
  [
    "Academia Orla Fit",
    "12345678000195",
    "Bruno Siqueira",
    "comercial@orlafit.example.com",
    "21987650001",
    140,
  ],
  [
    "Pizzaria Bella Lagoa",
    "23456789000110",
    "Renata Costa",
    "contato@bellalagoa.example.com",
    "21987650002",
    95,
  ],
  [
    "Clínica Sorriso Botafogo",
    "34567890000124",
    "Dr. Paulo Mendes",
    "marketing@sorrisobotafogo.example.com",
    "21987650003",
    60,
  ],
  [
    "Imobiliária Copa Imóveis",
    "45678901000136",
    "Sandra Lima",
    "sandra@copaimoveis.example.com",
    undefined,
    220,
  ],
  [
    "Livraria Catete",
    "56789012000148",
    "André Rocha",
    "andre@livrariacatete.example.com",
    "21987650005",
    30,
  ],
] as const;

export type CampaignMock = {
  n: number;
  name: string;
  advertiser: number;
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED";
  startsInDays: number;
  durationDays: number;
  slots: AdSlotKey[];
  categories?: string[];
  neighborhoods?: string[];
  /** Impressões e cliques por criativo, na ordem dos slots. */
  delivered?: [number, number][];
  goalImpressions?: number;
};

export const campaignsMock: CampaignMock[] = [
  {
    n: 1,
    name: "Primeira semana grátis — outubro",
    advertiser: 0,
    status: "ACTIVE",
    startsInDays: -14,
    durationDays: 31,
    slots: ["HOME_SIDEBAR", "MOBILE_STICKY"],
    neighborhoods: ["copacabana", "ipanema", "leblon"],
    delivered: [
      [41_200, 118],
      [96_300, 1_210],
    ],
    goalImpressions: 300_000,
  },
  {
    n: 2,
    name: "Rodízio de quarta",
    advertiser: 1,
    status: "ACTIVE",
    startsInDays: -6,
    durationDays: 20,
    slots: ["ARTICLE_MIDDLE"],
    categories: ["entretenimento"],
    delivered: [[58_900, 551]],
    goalImpressions: 150_000,
  },
  {
    n: 3,
    name: "Clareamento com desconto",
    advertiser: 2,
    status: "ACTIVE",
    startsInDays: -20,
    durationDays: 45,
    slots: ["ARTICLE_TOP", "CATEGORY_TOP"],
    neighborhoods: ["botafogo", "flamengo"],
    delivered: [
      [133_000, 640],
      [21_400, 83],
    ],
  },
  {
    n: 4,
    name: "Lançamento Posto 6",
    advertiser: 3,
    status: "SCHEDULED",
    startsInDays: 5,
    durationDays: 30,
    slots: ["HOME_TOP", "ARTICLE_BOTTOM"],
    categories: ["economia"],
    goalImpressions: 500_000,
  },
  {
    n: 5,
    name: "Semana do livro infantil",
    advertiser: 4,
    status: "PAUSED",
    startsInDays: -3,
    durationDays: 14,
    slots: ["HOME_MIDDLE"],
    delivered: [[12_100, 49]],
  },
  {
    n: 6,
    name: "Verão 2026",
    advertiser: 0,
    status: "ENDED",
    startsInDays: -280,
    durationDays: 60,
    slots: ["HOME_TOP", "MOBILE_STICKY"],
    delivered: [
      [610_000, 3_050],
      [420_000, 5_460],
    ],
    goalImpressions: 1_000_000,
  },
  {
    n: 7,
    name: "Black Friday imóveis",
    advertiser: 3,
    status: "DRAFT",
    startsInDays: 35,
    durationDays: 10,
    slots: ["HOME_TOP"],
  },
];

/** Onde cada posição aparece no site (mapa da tela de Posições). */
export const slotPagesMock: Record<AdSlotKey, "home" | "article" | "category" | "mobile"> = {
  HOME_TOP: "home",
  HOME_MIDDLE: "home",
  HOME_SIDEBAR: "home",
  ARTICLE_TOP: "article",
  ARTICLE_MIDDLE: "article",
  ARTICLE_BOTTOM: "article",
  CATEGORY_TOP: "category",
  MOBILE_STICKY: "mobile",
};
