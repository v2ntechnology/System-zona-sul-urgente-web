// Navegação e URLs do portal. Provisório até a API de categorias/localidades (BE-004):
// depois as editorias passam a vir do service, com o mesmo formato.

export type NavItem = { label: string; href: string };

type CategoryLike = { slug: string; parent?: { slug: string } };
type NewsLike = { slug: string; category: CategoryLike };

/**
 * URLs no padrão CNN/g1 (decisão de 2026-10-15):
 *   /{editoria}                      ex.: /seguranca
 *   /{editoria}/{subeditoria}        ex.: /entretenimento/gastronomia
 *   /{editoria}/{slug-da-noticia}    ex.: /seguranca/policia-prende-suspeito...
 *   /{editoria}/{sub}/{slug}         ex.: /entretenimento/gastronomia/novo-restaurante...
 * Como editorias ficam na raiz, os nomes de RESERVED_SLUGS nunca podem ser editoria.
 */
export const routes = {
  home: "/",
  search: "/busca",
  category: (category: CategoryLike) =>
    category.parent ? `/${category.parent.slug}/${category.slug}` : `/${category.slug}`,
  news: (news: NewsLike) => `${routes.category(news.category)}/${news.slug}`,
  neighborhood: (slug: string) => `/bairro/${slug}`,
  /** Web Story (página AMP fora do layout do site). Usar <a>, não <Link>. */
  story: (slug: string) => `/stories/${slug}`,
  /** RSS geral ou da editoria. */
  feed: (categorySlug?: string) => (categorySlug ? `/feed/${categorySlug}.xml` : "/feed.xml"),
} as const;

/** Primeiros segmentos usados por rotas fixas do site. */
export const RESERVED_SLUGS = new Set([
  "admin",
  // Rotas do site antigo, redirecionadas na migração (ver OPS-003).
  "article",
  "category",
  "search",
  "anuncie",
  "api",
  "ao-vivo",
  "offline",
  "autor",
  "bairro",
  "busca",
  "expediente",
  "feed",
  "privacidade",
  "quem-somos",
  "rss",
  "sitemap",
  "stories",
  "brand",
  "tag",
  "termos",
  "zona",
]);

type Section = NavItem & {
  slug: string;
  /** Aparece na barra azul e na faixa do celular; as demais ficam só no menu ☰ e no rodapé. */
  inBar: boolean;
  children?: NavItem[];
};

const section = (
  slug: string,
  label: string,
  inBar: boolean,
  children?: [string, string][],
): Section => ({
  slug,
  label,
  inBar,
  href: routes.category({ slug }),
  children: children?.map(([childSlug, childLabel]) => ({
    label: childLabel,
    href: routes.category({ slug: childSlug, parent: { slug } }),
  })),
});

/** Todas as editorias, na ordem do menu. Slugs batem com a taxonomia (ver teste). */
export const allSections: Section[] = [
  section("seguranca", "Segurança", true),
  section("transito", "Trânsito", true),
  section("cidade", "Cidade", true),
  section("politica", "Política", true),
  section("economia", "Economia", true),
  section("esportes", "Esportes", true),
  section("entretenimento", "Entretenimento", true, [
    ["gastronomia", "Gastronomia"],
    ["eventos", "Eventos"],
  ]),
  section("comunidade", "Comunidade", false),
  section("classificados", "Classificados", false),
];

/** Editorias principais (barra), como a CNN: as demais aparecem no menu ☰. */
export const sections: NavItem[] = allSections.filter((s) => s.inBar);

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

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
