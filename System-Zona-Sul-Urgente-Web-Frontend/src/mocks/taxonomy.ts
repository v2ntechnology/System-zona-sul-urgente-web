import type { Author, Category, City, Neighborhood, Tag } from "@/types/news";

// Dados de exemplo (FE-009). Nunca importar em componentes: use os services.
// Slugs de editorias e bairros batem com src/config/navigation.ts.

/** UUID estável no formato v7 para dados de exemplo. */
export function mockId(kind: number, n: number): string {
  return `0192a1b2-${kind.toString(16).padStart(4, "0")}-7000-8000-${n.toString(16).padStart(12, "0")}`;
}

export const categories: Category[] = [
  ["seguranca", "Segurança", "Ocorrências, policiamento e segurança pública na Zona Sul."],
  ["transito", "Trânsito", "Interdições, obras e transporte público."],
  ["cidade", "Cidade", "Serviços, obras e o dia a dia dos bairros."],
  ["comunidade", "Comunidade", "Projetos sociais, iniciativas locais e histórias dos moradores."],
  ["politica", "Política", "Decisões da prefeitura, da Câmara e o que muda para a região."],
  ["gastronomia", "Gastronomia", "Restaurantes, bares e sabores da Zona Sul."],
  ["eventos-e-lazer", "Eventos e lazer", "Agenda cultural, shows, feiras e passeios."],
  ["classificados", "Classificados", "Imóveis, empregos e oportunidades locais."],
].map(([slug, name, description], i) => ({ id: mockId(1, i + 1), slug, name, description }));

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
].map(([slug, name], i) => ({ id: mockId(3, i + 1), slug, name, citySlug: city.slug }));

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
