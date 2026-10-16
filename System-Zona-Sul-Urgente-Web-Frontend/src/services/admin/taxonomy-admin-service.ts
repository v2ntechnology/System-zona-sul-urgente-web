import { newsMock } from "@/mocks/news";
import { categories, tags } from "@/mocks/taxonomy";
import type { Category } from "@/types/news";

// Gestão de editorias e tópicos (FE-158). Hoje sobre mocks; depois
// GET/POST/PUT /api/v1/admin/{categories,tags} (+ /merge para tópicos).

export type AdminCategory = Category & { newsCount: number };
export type AdminTag = {
  id: string;
  slug: string;
  name: string;
  newsCount: number;
  lastUsedAt?: string;
};

/** Todas as editorias (inclusive desativadas), com quantas matérias cada uma tem. */
export async function listCategoriesAdmin(): Promise<AdminCategory[]> {
  return categories.map((c) => ({
    ...c,
    newsCount: newsMock.filter(
      (n) => n.category.slug === c.slug || n.category.parent?.slug === c.slug,
    ).length,
  }));
}

/** Tópicos com uso (matérias) e quando foram usados por último; mais usados primeiro. */
export async function listTagsAdmin(): Promise<AdminTag[]> {
  return tags
    .map((t) => {
      const used = newsMock.filter((n) => n.tags.some((x) => x.slug === t.slug));
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        newsCount: used.length,
        lastUsedAt: used[0]?.publishedAt,
      };
    })
    .sort((a, b) => b.newsCount - a.newsCount || a.name.localeCompare(b.name, "pt-BR"));
}
