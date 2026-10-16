import type { EditorOptions, EditorPermissions } from "@/components/admin/editor/news-editor";
import { can } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";
import { getAuthors, getCategories, getNeighborhoods, getTags } from "@/services/taxonomy-service";

/** Opções dos campos e permissões do usuário para o editor (servidor). */
export async function loadEditorProps(): Promise<{
  options: EditorOptions;
  permissions: EditorPermissions;
  /** Autor do usuário logado: vem marcado em notícia nova (como o "seu perfil" do post). */
  defaultAuthorSlug?: string;
}> {
  const [user, categories, authors, neighborhoods, tags] = await Promise.all([
    getCurrentUser(),
    getCategories(),
    getAuthors(),
    getNeighborhoods(),
    getTags(),
  ]);
  return {
    options: {
      // Só itens ativos (desativados continuam nas matérias antigas, mas não são oferecidos).
      categories: categories
        .filter((c) => c.active !== false)
        .map((c) => ({
          slug: c.slug,
          name: c.name,
          parentName: c.parent?.name,
        })),
      authors: authors
        .filter((a) => a.active !== false)
        .map((a) => ({ slug: a.slug, name: a.name })),
      neighborhoods: neighborhoods.map((n) => ({ slug: n.slug, name: n.name })),
      tags: tags.map((t) => ({ slug: t.slug, name: t.name })),
    },
    defaultAuthorSlug: user.authorSlug,
    permissions: {
      canPublish: can(user.role, "news.publish"),
      canMarkUrgent: can(user.role, "news.mark_urgent"),
      canMarkSponsored: can(user.role, "news.mark_sponsored"),
      canCreateTags: can(user.role, "tags.manage"),
    },
  };
}
