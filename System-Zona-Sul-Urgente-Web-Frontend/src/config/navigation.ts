// Navegação do portal. Provisório até a API de categorias/localidades (BE-004):
// depois estes dados passam a vir do service, com o mesmo formato.

export type NavItem = { label: string; href: string };

// Rotas públicas: /categoria/[slug], /bairro/[slug], /busca, /noticia/[slug] (ARCHITECTURE §11).
export const routes = {
  home: "/",
  search: "/busca",
  category: (slug: string) => `/categoria/${slug}`,
  neighborhood: (slug: string) => `/bairro/${slug}`,
  news: (slug: string) => `/noticia/${slug}`,
} as const;

// Editorias herdadas do site atual.
export const sections: NavItem[] = [
  { label: "Segurança", href: routes.category("seguranca") },
  { label: "Trânsito", href: routes.category("transito") },
  { label: "Cidade", href: routes.category("cidade") },
  { label: "Comunidade", href: routes.category("comunidade") },
  { label: "Política", href: routes.category("politica") },
  { label: "Gastronomia", href: routes.category("gastronomia") },
  { label: "Eventos e lazer", href: routes.category("eventos-e-lazer") },
  { label: "Classificados", href: routes.category("classificados") },
];

export const neighborhoods: NavItem[] = [
  "Botafogo",
  "Catete",
  "Copacabana",
  "Cosme Velho",
  "Flamengo",
  "Gávea",
  "Glória",
  "Humaitá",
  "Ipanema",
  "Jardim Botânico",
  "Lagoa",
  "Laranjeiras",
  "Leblon",
  "Leme",
  "Rocinha",
  "São Conrado",
  "Urca",
  "Vidigal",
].map((label) => ({ label, href: routes.neighborhood(slugify(label)) }));

export const institutional: NavItem[] = [
  { label: "Quem somos", href: "/quem-somos" },
  { label: "Expediente", href: "/expediente" },
  { label: "Anuncie", href: "/anuncie" },
  { label: "Política de privacidade", href: "/privacidade" },
  { label: "Termos de uso", href: "/termos" },
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
