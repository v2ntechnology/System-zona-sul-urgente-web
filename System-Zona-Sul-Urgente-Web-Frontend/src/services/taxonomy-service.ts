import { routes, type SiteSection } from "@/config/navigation";
import { authors, categories, neighborhoods, tags } from "@/mocks/taxonomy";
import { apiBaseUrl } from "@/services/api/client";
import * as api from "@/services/api/public-api";
import type { Author, Category, Neighborhood, Tag } from "@/types/news";

// Taxonomia (FE-010). Com API_URL: GET /api/v1/public/{categories,neighborhoods,authors,tags};
// sem ela, dados de exemplo.

export async function getCategories(): Promise<Category[]> {
  if (apiBaseUrl()) return api.categories();
  return categories;
}

export async function getNeighborhoods(): Promise<Neighborhood[]> {
  if (apiBaseUrl()) return api.neighborhoods();
  return neighborhoods;
}

/** Subeditorias diretas de uma editoria (um nível). */
export async function getSubcategories(parentSlug: string): Promise<Category[]> {
  return (await getCategories()).filter((c) => c.parent?.slug === parentSlug);
}

/** Tópicos em destaque (sugestões da busca). Depois: os mais buscados de verdade. */
export async function getPopularTags(limit = 8): Promise<Tag[]> {
  if (apiBaseUrl()) return api.popularTags(limit);
  return tags.slice(0, limit);
}

export async function getAuthors(): Promise<Author[]> {
  if (apiBaseUrl()) return api.authors();
  return authors;
}

export async function getTags(): Promise<Tag[]> {
  if (apiBaseUrl()) return api.tags();
  return tags;
}

/**
 * Editorias do menu do site (barra, menu ☰ e rodapé), na ordem cadastrada no painel.
 * Só as ativas; subeditorias (e colunas) aparecem como filhas da mãe.
 */
export async function getSiteSections(): Promise<SiteSection[]> {
  const byOrder = (a: Category, b: Category) => (a.order ?? 999) - (b.order ?? 999);
  const active = (await getCategories()).filter((c) => c.active !== false);
  return active
    .filter((c) => !c.parent)
    .sort(byOrder)
    .map((root) => {
      const children = active
        .filter((c) => c.parent?.slug === root.slug)
        .sort(byOrder)
        .map((c) => ({ label: c.name, href: routes.category(c) }));
      return {
        slug: root.slug,
        label: root.name,
        href: routes.category(root),
        inBar: Boolean(root.inBar),
        ...(children.length > 0 && { children }),
      };
    });
}
