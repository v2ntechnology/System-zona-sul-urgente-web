import type {
  AdminNewsRow,
  AdminUser,
  InstagramImportStatus,
  InstagramMediaType,
} from "@/types/admin";
import type { NewsOrigin, NewsStatus } from "@/types/news";

import { MOCK_NOW, newsMock, viewsBySlug } from "@/mocks/news";
import { findCategory, mockId } from "@/mocks/taxonomy";

// Dados de exemplo do painel (FE-152..155). Nunca importar em componentes: use os services.

export const currentUserMock: AdminUser = {
  id: mockId(40, 1),
  name: "Juliana Prado",
  email: "juliana.prado@zonasulurgente.com.br",
  // ADMIN no mock para o painel inteiro aparecer na prévia (publicidade inclusive).
  role: "ADMIN",
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
  imageUrl: n.image?.url,
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
  // Rascunhos do Instagram já vêm com a foto do post; os manuais ainda não têm foto.
  imageUrl:
    e.origin === "INSTAGRAM" ? `https://picsum.photos/seed/rascunho-${i + 1}/1200/675` : undefined,
}));

export const adminNewsMock: AdminNewsRow[] = [...extraRows, ...published].sort((a, b) =>
  b.updatedAt.localeCompare(a.updatedAt),
);

export type InstagramPostMock = {
  id: string;
  /** Legenda original (imutável no sistema). */
  caption: string;
  /** Legenda atual na origem (só quando mudou depois da importação). */
  currentCaption?: string;
  permalink: string;
  postedAt: string;
  status: InstagramImportStatus;
  mediaType: InstagramMediaType;
  mediaCount?: number;
  /** Notícia gerada a partir do post, quando houver. */
  newsSlug?: string;
  error?: string;
  attempts?: number;
  ignoredReason?: string;
  sourceChangedHoursAgo?: number;
};

const post = (n: number) => `https://www.instagram.com/p/exemplo${n}/`;

export const instagramPostsMock: InstagramPostMock[] = [
  {
    id: "ig-1",
    caption:
      "🚨 URGENTE: moradores relatam tiroteio no alto do morro nesta tarde. PM confirma operação em andamento. Evitem a região.",
    permalink: post(1),
    postedAt: hoursBefore(0.3),
    status: "IMPORTED",
    mediaType: "VIDEO",
    newsSlug: "rascunho-1",
  },
  {
    id: "ig-8",
    caption:
      "Fila enorme no ponto do BRS da Rua Voluntários da Pátria agora. Ônibus não passa há 40 minutos, segundo passageiros. 🚌",
    permalink: post(8),
    postedAt: hoursBefore(0.1),
    status: "NEW",
    mediaType: "IMAGE",
  },
  {
    id: "ig-9",
    caption:
      "Golfinhos foram vistos agora há pouco na Praia do Leme! 🐬 Vídeo enviado por seguidor. Que cena!",
    permalink: post(9),
    postedAt: hoursBefore(0.4),
    status: "NEW",
    mediaType: "VIDEO",
  },
  {
    id: "ig-2",
    caption:
      "Chuva forte agora em Copacabana! Avenida Atlântica com pontos de alagamento perto do Posto 4. 🌧️ #chuva #copacabana",
    permalink: post(2),
    postedAt: hoursBefore(0.6),
    status: "IMPORTED",
    mediaType: "VIDEO",
    newsSlug: "temporal-alaga-ruas-de-copacabana-e-botafogo",
  },
  {
    id: "ig-6",
    caption: "Galera, vídeo do acidente no Rebouças agora há pouco…",
    permalink: post(6),
    postedAt: hoursBefore(1.1),
    status: "ERROR",
    mediaType: "VIDEO",
    error: "Falha ao baixar o vídeo (tempo esgotado). Nova tentativa automática em 5 min.",
    attempts: 2,
  },
  {
    id: "ig-10",
    caption:
      "Atenção: Túnel Novo com trânsito lento sentido Botafogo. Carro enguiçado na faixa da esquerda.",
    permalink: post(10),
    postedAt: hoursBefore(1.6),
    status: "ERROR",
    mediaType: "IMAGE",
    error:
      "A IA não retornou um texto válido (campo título vazio). Reprocesse ou crie a notícia manualmente.",
    attempts: 3,
  },
  {
    id: "ig-11",
    caption:
      "Polícia prende suspeito de assaltos em série na orla de Copacabana. Ele foi reconhecido por câmeras.",
    permalink: post(11),
    postedAt: hoursBefore(3.2),
    status: "IMPORTED",
    mediaType: "CAROUSEL_ALBUM",
    mediaCount: 3,
    newsSlug: "policia-prende-suspeito-de-assaltos-na-orla-de-copacabana",
  },
  {
    id: "ig-3",
    caption: "Ciclista assaltado no Posto 9 hoje cedo. Vídeo enviado por seguidor. Fiquem atentos!",
    currentCaption:
      "Ciclista assaltado no Posto 8 hoje cedo, por volta das 6h. Vídeo enviado por seguidor. A vítima passa bem. Fiquem atentos!",
    permalink: post(3),
    postedAt: hoursBefore(5.2),
    status: "CHANGED_AT_SOURCE",
    mediaType: "VIDEO",
    newsSlug: "ciclista-e-assaltado-na-orla-de-ipanema",
    sourceChangedHoursAgo: 0.5,
  },
  {
    id: "ig-5",
    caption: "Iluminação da praça em Ipanema está apagada há uma semana, dizem moradores.",
    permalink: post(5),
    postedAt: hoursBefore(5.5),
    status: "IMPORTED",
    mediaType: "CAROUSEL_ALBUM",
    mediaCount: 4,
    newsSlug: "rascunho-3",
  },
  {
    id: "ig-4",
    caption: "Publi: conheça a nova academia da orla! Primeira semana grátis 💪",
    permalink: post(4),
    postedAt: hoursBefore(8),
    status: "IGNORED",
    mediaType: "IMAGE",
    ignoredReason: "Publicidade detectada automaticamente (“Publi”).",
  },
  {
    id: "ig-12",
    caption: "Bom dia, Zona Sul! ☀️ Como está o tempo aí no seu bairro?",
    permalink: post(12),
    postedAt: hoursBefore(9),
    status: "IGNORED",
    mediaType: "IMAGE",
    ignoredReason: "Ignorado por Juliana Prado: post de interação, sem notícia.",
  },
  {
    id: "ig-7",
    caption: "Feira da Glória muda de lugar em novembro! Saiba mais no link da bio.",
    permalink: post(7),
    postedAt: hoursBefore(18.5),
    status: "REMOVED_AT_SOURCE",
    mediaType: "IMAGE",
    newsSlug: "feira-da-gloria-muda-de-endereco",
    sourceChangedHoursAgo: 2,
  },
];

/** Texto gerado pela IA para os rascunhos vindos do Instagram (só existe no painel). */
export const draftContentMock: Record<string, { summary: string; paragraphs: string[] }> = {
  "rascunho-1": {
    summary:
      "Moradores relataram disparos na tarde desta quarta-feira; a Polícia Militar confirmou uma operação em andamento.",
    paragraphs: [
      "Moradores relataram tiroteio no alto do morro na tarde desta quarta-feira. A Polícia Militar confirmou que faz uma operação na região.",
      "A recomendação é evitar a área até o fim da ação policial.",
    ],
  },
  "rascunho-3": {
    summary: "Segundo moradores, a iluminação da praça está apagada há uma semana.",
    paragraphs: [
      "Moradores de Ipanema reclamam que a iluminação da praça está apagada há uma semana.",
    ],
  },
};

export const instagramConnectionMock = {
  username: "zonasulurgente",
  lastCheckAt: new Date(MOCK_NOW.getTime() - 2 * 60_000).toISOString(),
  pollMinutes: 3,
  tokenExpiresAt: hoursAfter(41 * 24),
  publishRule: "DRAFT" as const,
};
