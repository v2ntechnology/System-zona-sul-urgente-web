import type { AdminNewsRow, AdminUser, InstagramImportStatus } from "@/types/admin";
import type { NewsOrigin, NewsStatus } from "@/types/news";

import { MOCK_NOW, newsMock, viewsBySlug } from "@/mocks/news";
import { findCategory, mockId } from "@/mocks/taxonomy";

// Dados de exemplo do painel (FE-152..155). Nunca importar em componentes: use os services.

export const currentUserMock: AdminUser = {
  id: mockId(40, 1),
  name: "Juliana Prado",
  email: "juliana.prado@zonasulurgente.com.br",
  role: "EDITOR",
  authorSlug: "juliana-prado",
};

const hoursBefore = (h: number) => new Date(MOCK_NOW.getTime() - h * 3_600_000).toISOString();
const hoursAfter = (h: number) => new Date(MOCK_NOW.getTime() + h * 3_600_000).toISOString();

const published: AdminNewsRow[] = newsMock.map((n) => ({
  id: n.id,
  slug: n.slug,
  title: n.title,
  status: "PUBLISHED",
  category: n.category,
  authors: n.authors.map((a) => a.name),
  origin: n.origin,
  isUrgent: n.isUrgent,
  isSponsored: n.isSponsored,
  updatedAt: n.updatedAt ?? n.publishedAt,
  publishedAt: n.publishedAt,
  views: viewsBySlug.get(n.slug)?.total ?? 0,
}));

type Extra = {
  title: string;
  status: NewsStatus;
  category: string;
  authors: string[];
  origin?: NewsOrigin;
  hoursAgo: number;
  scheduledInHours?: number;
  deleted?: boolean;
  urgent?: boolean;
};

const extras: Extra[] = [
  {
    title: "Moradores relatam tiroteio no alto do morro; PM confirma operação",
    status: "DRAFT",
    category: "seguranca",
    authors: ["Redação Zona Sul Urgente"],
    origin: "INSTAGRAM",
    hoursAgo: 0.2,
    urgent: true,
  },
  {
    title: "Obra no Corte do Cantagalo interdita faixa a partir de segunda",
    status: "DRAFT",
    category: "transito",
    authors: ["Rafael Duarte"],
    hoursAgo: 2,
  },
  {
    title: "Associação de Ipanema pede mais iluminação na Praça Nossa Senhora da Paz",
    status: "DRAFT",
    category: "cidade",
    authors: ["Carlos Menezes"],
    origin: "INSTAGRAM",
    hoursAgo: 5,
  },
  {
    title: "Vereadores aprovam regras para patinetes elétricos na orla",
    status: "IN_REVIEW",
    category: "politica",
    authors: ["Juliana Prado"],
    hoursAgo: 1,
  },
  {
    title: "Escola de samba da Zona Sul anuncia enredo para 2027",
    status: "IN_REVIEW",
    category: "eventos",
    authors: ["Ana Ribeiro"],
    hoursAgo: 3,
  },
  {
    title: "Guia: onde assistir aos fogos de Réveillon em Copacabana",
    status: "SCHEDULED",
    category: "eventos",
    authors: ["Juliana Prado", "Ana Ribeiro"],
    hoursAgo: 6,
    scheduledInHours: 20,
  },
  {
    title: "Loja tradicional de Botafogo fecha após 40 anos",
    status: "UNPUBLISHED",
    category: "economia",
    authors: ["Carlos Menezes"],
    hoursAgo: 50,
  },
  {
    title: "Nota duplicada sobre interdição no Aterro",
    status: "DRAFT",
    category: "transito",
    authors: ["Rafael Duarte"],
    hoursAgo: 30,
    deleted: true,
  },
];

const extraRows: AdminNewsRow[] = extras.map((e, i) => ({
  id: mockId(41, i + 1),
  slug: `rascunho-${i + 1}`,
  title: e.title,
  status: e.status,
  category: findCategory(e.category),
  authors: e.authors,
  origin: e.origin ?? "MANUAL",
  isUrgent: Boolean(e.urgent),
  isSponsored: false,
  updatedAt: hoursBefore(e.hoursAgo),
  scheduledFor: e.scheduledInHours ? hoursAfter(e.scheduledInHours) : undefined,
  deletedAt: e.deleted ? hoursBefore(e.hoursAgo - 1) : undefined,
  views: 0,
}));

export const adminNewsMock: AdminNewsRow[] = [...extraRows, ...published].sort((a, b) =>
  b.updatedAt.localeCompare(a.updatedAt),
);

export type InstagramPostMock = {
  id: string;
  /** Legenda original (imutável no sistema). */
  caption: string;
  permalink: string;
  postedAt: string;
  status: InstagramImportStatus;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  /** Notícia gerada a partir do post, quando houver. */
  newsSlug?: string;
  error?: string;
};

export const instagramPostsMock: InstagramPostMock[] = [
  {
    id: "ig-1",
    caption:
      "🚨 URGENTE: moradores relatam tiroteio no alto do morro nesta tarde. PM confirma operação em andamento. Evitem a região.",
    permalink: "https://www.instagram.com/p/exemplo1/",
    postedAt: hoursBefore(0.3),
    status: "NEW",
    mediaType: "VIDEO",
  },
  {
    id: "ig-2",
    caption:
      "Chuva forte agora em Copacabana! Avenida Atlântica com pontos de alagamento perto do Posto 4. 🌧️ #chuva #copacabana",
    permalink: "https://www.instagram.com/p/exemplo2/",
    postedAt: hoursBefore(0.6),
    status: "IMPORTED",
    mediaType: "VIDEO",
    newsSlug: "temporal-alaga-ruas-de-copacabana-e-botafogo",
  },
  {
    id: "ig-3",
    caption: "Ciclista assaltado no Posto 9 hoje cedo. Vídeo enviado por seguidor. Fiquem atentos!",
    permalink: "https://www.instagram.com/p/exemplo3/",
    postedAt: hoursBefore(5.2),
    status: "CHANGED_AT_SOURCE",
    mediaType: "VIDEO",
    newsSlug: "ciclista-e-assaltado-na-orla-de-ipanema",
  },
  {
    id: "ig-4",
    caption: "Publi: conheça a nova academia da orla! Primeira semana grátis 💪",
    permalink: "https://www.instagram.com/p/exemplo4/",
    postedAt: hoursBefore(8),
    status: "IGNORED",
    mediaType: "IMAGE",
  },
  {
    id: "ig-5",
    caption: "Iluminação da praça em Ipanema está apagada há uma semana, dizem moradores.",
    permalink: "https://www.instagram.com/p/exemplo5/",
    postedAt: hoursBefore(5.5),
    status: "NEW",
    mediaType: "CAROUSEL_ALBUM",
  },
  {
    id: "ig-6",
    caption: "Galera, vídeo do acidente no Rebouças agora há pouco…",
    permalink: "https://www.instagram.com/p/exemplo6/",
    postedAt: hoursBefore(1.1),
    status: "ERROR",
    mediaType: "VIDEO",
    error: "Falha ao baixar o vídeo (tempo esgotado). Nova tentativa em 5 min.",
  },
  {
    id: "ig-7",
    caption: "Feira da Glória muda de lugar em novembro! Saiba mais no link da bio.",
    permalink: "https://www.instagram.com/p/exemplo7/",
    postedAt: hoursBefore(18.5),
    status: "REMOVED_AT_SOURCE",
    mediaType: "IMAGE",
    newsSlug: "feira-da-gloria-muda-de-endereco",
  },
];

export const activeCampaignsMock = 3;
export const viewsTodayMock = { today: 84_210, yesterday: 71_900 };
