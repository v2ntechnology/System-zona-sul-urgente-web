import type { Author, Category, City, Neighborhood, Tag, Zone } from "@/types/news";

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
].map(([slug, name, description], i) => ({
  id: mockId(1, i + 1),
  slug,
  name,
  description,
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
  parent: ref(parent),
  whatsappUrl: `https://whatsapp.com/channel/exemplo-${slug}`,
}));

export const categories: Category[] = [...mainCategories, ...subCategories];

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
