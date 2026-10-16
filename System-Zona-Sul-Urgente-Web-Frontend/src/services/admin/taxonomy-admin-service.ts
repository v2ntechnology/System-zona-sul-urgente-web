import { newsMock } from "@/mocks/news";
import { categories, tags } from "@/mocks/taxonomy";
import { adminGet } from "@/services/admin/admin-api";
import { apiBaseUrl } from "@/services/api/client";
import type { Category, SectionColor } from "@/types/news";

// Gestão de editorias e tópicos (FE-158). Com API_URL: /api/v1/admin/{categories,tags};
// sem API, sobre os mocks (as telas simulam as mudanças).

export type AdminCategory = Category & { newsCount: number };
export type AdminTag = {
  id: string;
  slug: string;
  name: string;
  newsCount: number;
  lastUsedAt?: string;
  active?: boolean;
};

/** Editoria como a API do painel devolve (parentSlug em vez do objeto da mãe). */
export type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  parentSlug?: string;
  color?: SectionColor;
  inBar: boolean;
  active: boolean;
  order: number;
  whatsappUrl?: string;
  description?: string;
  newsCount: number;
};

export function fromApiCategories(list: ApiCategory[]): AdminCategory[] {
  const bySlug = new Map(list.map((c) => [c.slug, c]));
  return list.map((c) => {
    const parent = c.parentSlug ? bySlug.get(c.parentSlug) : undefined;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      parent: parent && { id: parent.id, slug: parent.slug, name: parent.name },
      whatsappUrl: c.whatsappUrl,
      order: c.order,
      inBar: c.inBar,
      active: c.active,
      color: c.color ?? parent?.color,
      newsCount: c.newsCount,
    };
  });
}

/** Todas as editorias (inclusive desativadas), com quantas matérias cada uma tem. */
export async function listCategoriesAdmin(): Promise<AdminCategory[]> {
  if (apiBaseUrl()) return fromApiCategories((await adminGet<ApiCategory[]>("/categories")) ?? []);
  return categories.map((c) => ({
    ...c,
    newsCount: newsMock.filter(
      (n) => n.category.slug === c.slug || n.category.parent?.slug === c.slug,
    ).length,
  }));
}

/** Tópicos com uso (matérias) e quando foram usados por último; mais usados primeiro. */
export async function listTagsAdmin(): Promise<AdminTag[]> {
  if (apiBaseUrl()) return (await adminGet<AdminTag[]>("/tags")) ?? [];
  return tags
    .map((t) => {
      const used = newsMock.filter((n) => n.tags.some((x) => x.slug === t.slug));
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        newsCount: used.length,
        lastUsedAt: used[0]?.publishedAt,
        active: true,
      };
    })
    .sort((a, b) => b.newsCount - a.newsCount || a.name.localeCompare(b.name, "pt-BR"));
}
