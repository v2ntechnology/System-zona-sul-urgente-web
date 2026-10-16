import type { Author, Category, City, Neighborhood, SectionColor, Tag, Zone } from "@/types/news";

// Dados de exemplo (FE-009). Nunca importar em componentes: use os services.
// Slugs de editorias e bairros batem com src/config/navigation.ts (há teste para isso).

/** UUID estável no formato v7 para dados de exemplo. */
export function mockId(kind: number, n: number): string {
  return `0192a1b2-${kind.toString(16).padStart(4, "0")}-7000-8000-${n.toString(16).padStart(12, "0")}`;
}

const mainCategories: Category[] = [
  ["seguranca", "Segurança", "Ocorrências, policiamento e segurança pública."],
  ["transito", "Trânsito", "Interdições, obras e transporte público."],
  ["cidade", "Cidade", "Serviços, obras e o dia a dia dos bairros."],
  ["politica", "Política", "Decisões da prefeitura, da Câmara e o que muda para a região."],
  ["economia", "Economia", "Comércio de bairro, imóveis, turismo, empregos, concursos e preços."],
  ["esportes", "Esportes", "Esporte local: praia, lagoa, clubes, atletas e eventos da região."],
  ["entretenimento", "Entretenimento", "Gastronomia, shows, feiras e passeios."],
  ["comunidade", "Comunidade", "Projetos sociais, iniciativas locais e histórias dos moradores."],
  ["classificados", "Classificados", "Imóveis, vagas de emprego e serviços locais."],
  ["colunas", "Blogs e colunas", "Opinião e análise de quem conhece a Zona Sul de perto."],
].map(([slug, name, description], i) => ({
  id: mockId(1, i + 1),
  slug,
  name,
  description,
  order: i + 1,
  active: true,
  // As 7 primeiras ficam na barra (padrão CNN); as demais, no menu ☰ e no rodapé.
  inBar: i < 7,
  color: slug === "colunas" ? undefined : (slug as SectionColor),
  // Links FICTÍCIOS de exemplo: trocar pelos canais reais de cada editoria.
  whatsappUrl: `https://whatsapp.com/channel/exemplo-${slug}`,
}));

const ref = (slug: string) => {
  const { id, name } = mainCategories.find((c) => c.slug === slug)!;
  return { id, slug, name };
};

// Subeditorias (um nível): URL /{mae}/{slug}.
const subCategories: Category[] = [
  ["gastronomia", "Gastronomia", "Restaurantes, bares e sabores.", "entretenimento"],
  ["eventos", "Eventos", "Agenda cultural, shows e feiras.", "entretenimento"],
].map(([slug, name, description, parent], i) => ({
  id: mockId(1, 100 + i),
  slug,
  name,
  description,
  order: i + 1,
  active: true,
  parent: ref(parent),
  whatsappUrl: `https://whatsapp.com/channel/exemplo-${slug}`,
}));

// Colunas (subeditorias de "colunas"): URL /colunas/{coluna} e posts em /colunas/{coluna}/{slug}.
// Colunistas FICTÍCIOS de exemplo: trocar pelos reais quando a redação definir.
export const columnsMock: [string, string, string, string, string][] = [
  [
    "bairro-a-bairro",
    "Bairro a Bairro",
    "marina-teixeira",
    "Marina Teixeira",
    "Urbanismo e vida nos bairros",
  ],
  [
    "plantao-seguranca",
    "Plantão Segurança",
    "ricardo-alves",
    "Ricardo Alves",
    "Segurança pública na Zona Sul",
  ],
  [
    "mar-e-areia",
    "Mar e Areia",
    "paula-monteiro",
    "Paula Monteiro",
    "Praias, lagoa e meio ambiente",
  ],
  [
    "bolso-carioca",
    "Bolso Carioca",
    "fernando-lacerda",
    "Fernando Lacerda",
    "Economia do dia a dia",
  ],
  [
    "arquibancada-sul",
    "Arquibancada Sul",
    "diego-martins",
    "Diego Martins",
    "Esporte amador e de praia",
  ],
];

const columnCategories: Category[] = columnsMock.map(
  ([slug, name, authorSlug, author, bio], i) => ({
    id: mockId(1, 200 + i),
    slug,
    name,
    description: `Coluna de ${author}: ${bio.toLowerCase()}.`,
    parent: ref("colunas"),
    columnist: { authorSlug, name: author, bio },
    order: i + 1,
    active: true,
  }),
);

export const categories: Category[] = [...mainCategories, ...subCategories, ...columnCategories];

export const zones: Zone[] = [{ id: mockId(6, 1), slug: "zona-sul", name: "Zona Sul" }];

export const city: City = {
  id: mockId(2, 1),
  slug: "rio-de-janeiro",
  name: "Rio de Janeiro",
  state: "RJ",
};

export const neighborhoods: Neighborhood[] = [
  ["botafogo", "Botafogo"],
  ["catete", "Catete"],
  ["copacabana", "Copacabana"],
  ["cosme-velho", "Cosme Velho"],
  ["flamengo", "Flamengo"],
  ["gavea", "Gávea"],
  ["gloria", "Glória"],
  ["humaita", "Humaitá"],
  ["ipanema", "Ipanema"],
  ["jardim-botanico", "Jardim Botânico"],
  ["lagoa", "Lagoa"],
  ["laranjeiras", "Laranjeiras"],
  ["leblon", "Leblon"],
  ["leme", "Leme"],
  ["rocinha", "Rocinha"],
  ["sao-conrado", "São Conrado"],
  ["urca", "Urca"],
  ["vidigal", "Vidigal"],
].map(([slug, name], i) => ({
  id: mockId(3, i + 1),
  slug,
  name,
  citySlug: city.slug,
  zone: zones[0],
}));

// Repórteres fictícios.
export const authors: Author[] = [
  ["ana-ribeiro", "Ana Ribeiro", "Repórter"],
  ["carlos-menezes", "Carlos Menezes", "Repórter"],
  ["juliana-prado", "Juliana Prado", "Editora"],
  ["rafael-duarte", "Rafael Duarte", "Repórter"],
  ["redacao", "Redação Zona Sul Urgente", "Redação"],
  ...columnsMock.map(([, , slug, name]) => [slug, name, "Colunista"]),
].map(([slug, name, role], i) => ({ id: mockId(4, i + 1), slug, name, role }));

export const tags: Tag[] = [
  ["chuva", "Chuva"],
  ["defesa-civil", "Defesa Civil"],
  ["orla", "Orla"],
  ["policia-militar", "Polícia Militar"],
  ["ciclovia", "Ciclovia"],
  ["onibus", "Ônibus"],
  ["praia", "Praia"],
  ["cultura", "Cultura"],
  ["saude", "Saúde"],
  ["obras", "Obras"],
  ["energia", "Energia"],
  ["feira", "Feira"],
  // Duplicados de propósito (criados por pessoas diferentes): exemplo para "Juntar" no painel.
  ["chuvas", "Chuvas"],
  ["onibus-2", "Onibus"],
].map(([slug, name], i) => ({ id: mockId(5, i + 1), slug, name }));

function bySlug<T extends { slug: string }>(list: T[], slug: string): T {
  const found = list.find((item) => item.slug === slug);
  if (!found) throw new Error(`Mock inconsistente: slug "${slug}" não existe.`);
  return found;
}

export const findCategory = (slug: string) => bySlug(categories, slug);
export const findNeighborhood = (slug: string) => bySlug(neighborhoods, slug);
export const findAuthor = (slug: string) => bySlug(authors, slug);
export const findTag = (slug: string) => bySlug(tags, slug);
