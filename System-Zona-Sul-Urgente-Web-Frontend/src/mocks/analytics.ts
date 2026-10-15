import { MOCK_NOW } from "@/mocks/news";

// Dados de exemplo do analytics (FE-156). Determinísticos (mesma semente = mesmos números),
// para a tela e os testes não mudarem a cada execução.

function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Peso de audiência por hora (madrugada baixa; picos às 8h, 12h e 19h–21h). */
const HOUR_WEIGHT = [
  0.9, 0.6, 0.4, 0.3, 0.3, 0.5, 1.4, 2.6, 3.6, 3.4, 3.1, 3.3, 3.9, 3.6, 3.2, 3.1, 3.3, 3.6, 4.1,
  4.6, 4.8, 4.2, 3.0, 1.8,
];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Meia-noite de hoje em Brasília. */
export const TODAY_START = new Date("2026-10-15T00:00:00-03:00");

/** Visualizações por dia (61 dias até hoje; hoje é parcial). Crescimento leve + fim de semana fraco. */
export const dailyViewsMock: { at: string; views: number }[] = (() => {
  const rand = random(156);
  const days = 61;
  return Array.from({ length: days }, (_, i) => {
    const at = new Date(TODAY_START.getTime() - (days - 1 - i) * DAY);
    const weekday = at.getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.78 : 1;
    const full = (82_000 + i * 260) * weekend * (0.9 + rand() * 0.2);
    return { at: at.toISOString(), views: Math.round(full) };
  });
})();

/** Visualizações por hora das últimas 48 h (para "hoje" e "24 h" com o período anterior). */
export const hourlyViewsMock: { at: string; views: number }[] = (() => {
  const rand = random(2026);
  const hours = 48;
  const weightSum = HOUR_WEIGHT.reduce((s, w) => s + w, 0);
  return Array.from({ length: hours }, (_, i) => {
    const at = new Date(MOCK_NOW.getTime() - (hours - i) * HOUR);
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: "America/Sao_Paulo",
      }).format(at),
    );
    const dayViews = i < hours - 24 ? 98_000 : 112_000;
    return {
      at: at.toISOString(),
      views: Math.round((dayViews * HOUR_WEIGHT[hour] * (0.88 + rand() * 0.24)) / weightSum),
    };
  });
})();

/** Notícias publicadas por período (atual, anterior). */
export const publishedMock = {
  hoje: [14, 12],
  "24h": [23, 25],
  "7d": [151, 139],
  "30d": [624, 571],
} as const;

/** Participação na audiência (soma 1). */
export const sourceShareMock = [
  { key: "instagram", label: "Instagram", share: 0.37 },
  { key: "google", label: "Google (busca e Discover)", share: 0.28 },
  { key: "whatsapp", label: "WhatsApp", share: 0.16 },
  { key: "direct", label: "Direto", share: 0.1 },
  { key: "facebook", label: "Facebook", share: 0.06 },
  { key: "other", label: "Outros", share: 0.03 },
];

export const deviceShareMock = [
  { key: "mobile", label: "Celular", share: 0.81 },
  { key: "desktop", label: "Computador", share: 0.16 },
  { key: "tablet", label: "Tablet", share: 0.03 },
];

/** Participação por editoria (slug → fatia). */
export const categoryShareMock: Record<string, number> = {
  seguranca: 0.31,
  transito: 0.18,
  cidade: 0.15,
  esportes: 0.1,
  economia: 0.08,
  politica: 0.07,
  entretenimento: 0.06,
  comunidade: 0.05,
};

/** Taxa de clique esperada por posição de anúncio (CTR). */
export const adSlotCtrMock: Record<string, { reach: number; ctr: number }> = {
  HOME_TOP: { reach: 0.34, ctr: 0.0062 },
  HOME_MIDDLE: { reach: 0.22, ctr: 0.0041 },
  HOME_SIDEBAR: { reach: 0.09, ctr: 0.0028 },
  ARTICLE_TOP: { reach: 0.71, ctr: 0.0048 },
  ARTICLE_MIDDLE: { reach: 0.58, ctr: 0.0093 },
  ARTICLE_BOTTOM: { reach: 0.31, ctr: 0.0035 },
  CATEGORY_TOP: { reach: 0.12, ctr: 0.0039 },
  MOBILE_STICKY: { reach: 0.66, ctr: 0.0124 },
};
