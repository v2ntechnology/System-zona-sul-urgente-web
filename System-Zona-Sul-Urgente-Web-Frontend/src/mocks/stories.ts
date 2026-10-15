import type { MediaAsset, WebStory } from "@/types/news";

import { newsMock } from "@/mocks/news";
import { findCategory, mockId } from "@/mocks/taxonomy";

// Web Stories de exemplo (FE-009). Fotos verticais do picsum com semente fixa.

const portrait = (seed: string, alt: string, n: number): MediaAsset => ({
  id: mockId(31, n),
  url: `https://picsum.photos/seed/${seed}/720/1280`,
  width: 720,
  height: 1280,
  alt,
});

type Seed = {
  slug: string;
  title: string;
  category: string;
  newsSlug?: string;
  hoursAgo: number;
  pages: string[];
};

const seeds: Seed[] = [
  {
    slug: "temporal-na-zona-sul-o-que-fazer-em-alagamentos",
    title: "Temporal na Zona Sul: o que fazer em caso de alagamento",
    category: "cidade",
    newsSlug: "temporal-alaga-ruas-de-copacabana-e-botafogo",
    hoursAgo: 1,
    pages: [
      "Chuva forte deixou pontos de alagamento em Copacabana e Botafogo nesta quarta.",
      "Não atravesse ruas alagadas, nem a pé nem de carro: a correnteza engana.",
      "Desligue a energia se a água entrar em casa e procure um local alto.",
      "Em emergência, ligue 199 (Defesa Civil) ou 193 (Bombeiros).",
    ],
  },
  {
    slug: "remadores-da-lagoa-conheca-os-campeoes",
    title: "Remadores da Lagoa: conheça os campeões do Estadual",
    category: "esportes",
    newsSlug: "remadores-da-lagoa-conquistam-ouro-no-estadual",
    hoursAgo: 5,
    pages: [
      "Clube da Lagoa Rodrigo de Freitas levou três ouros no Campeonato Estadual.",
      "As vitórias vieram no skiff, no double e no quatro sem.",
      "Boa parte da equipe começou a remar ainda na categoria de base.",
    ],
  },
  {
    slug: "onde-comer-bem-no-leblon-gastando-pouco",
    title: "Onde comer bem no Leblon gastando pouco",
    category: "gastronomia",
    newsSlug: "bares-do-leblon-lancam-circuito-de-petiscos",
    hoursAgo: 30,
    pages: [
      "Vinte bares do Leblon têm petisco especial a R$ 25 até o fim do mês.",
      "O público vota no melhor petisco pelo QR Code das mesas.",
      "Dica: chegue cedo nas sextas, as mesas na calçada lotam rápido.",
    ],
  },
  {
    slug: "feirao-de-empregos-em-botafogo-como-participar",
    title: "Feirão com 800 vagas em Botafogo: como participar",
    category: "economia",
    newsSlug: "feirao-de-empregos-em-botafogo-oferece-800-vagas",
    hoursAgo: 40,
    pages: [
      "Feirão de empregos oferece cerca de 800 vagas nesta sexta, das 9h às 16h.",
      "Há oportunidades em comércio, serviços e hotelaria, inclusive primeiro emprego.",
      "Leve currículo impresso e documento com foto.",
    ],
  },
  {
    slug: "pao-de-acucar-a-noite-no-feriado",
    title: "Pão de Açúcar à noite: horário estendido no feriado",
    category: "eventos",
    newsSlug: "pao-de-acucar-tera-horario-estendido-no-feriado",
    hoursAgo: 42,
    pages: [
      "O bondinho funciona até a meia-noite durante o feriado.",
      "Haverá música ao vivo no Morro da Urca a partir das 19h.",
      "Compre o ingresso antes: as filas no fim de tarde costumam ser longas.",
    ],
  },
];

const NOW = new Date("2026-10-15T15:00:00-03:00").getTime();

export const storiesMock: WebStory[] = seeds.map((seed, i) => {
  const news = newsMock.find((n) => n.slug === seed.newsSlug);
  return {
    id: mockId(30, i + 1),
    slug: seed.slug,
    title: seed.title,
    category: findCategory(seed.category),
    cover: portrait(`story-${seed.slug}-0`, `Capa da story: ${seed.title}`, i * 10 + 1),
    pages: seed.pages.map((text, p) => ({
      image: portrait(`story-${seed.slug}-${p}`, text, i * 10 + p + 2),
      text,
    })),
    news: news && { slug: news.slug, title: news.title, category: news.category },
    publishedAt: new Date(NOW - seed.hoursAgo * 3_600_000).toISOString(),
  };
});
