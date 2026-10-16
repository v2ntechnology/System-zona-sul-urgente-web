import { teamMock } from "@/mocks/admin";
import { newsMock } from "@/mocks/news";
import { authors } from "@/mocks/taxonomy";
import { adminGet } from "@/services/admin/admin-api";
import { apiBaseUrl } from "@/services/api/client";
import type { AuthorProfile, TeamMember } from "@/types/admin";

// Equipe e autores (FE-159). Com API_URL: /api/v1/admin/users (convite por link, perfil,
// desativar, zerar 2FA) e /api/v1/admin/authors; sem API, sobre os mocks. Exige
// users.manage (equipe) e authors.manage (autores).

const STATUS_ORDER = { ACTIVE: 0, INVITED: 1, DISABLED: 2 } as const;

export async function listTeam(): Promise<TeamMember[]> {
  if (apiBaseUrl()) return (await adminGet<TeamMember[]>("/users")) ?? [];
  return [...teamMock].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, "pt-BR"),
  );
}

/** Autores com e sem login, com número de matérias; ativos primeiro. */
export async function listAuthorProfiles(): Promise<AuthorProfile[]> {
  if (apiBaseUrl()) return (await adminGet<AuthorProfile[]>("/authors")) ?? [];
  return authors
    .map((a) => {
      const member = teamMock.find((m) => m.authorSlug === a.slug);
      return {
        id: a.id,
        slug: a.slug,
        name: a.name,
        role: a.role,
        bio: a.bio ?? "",
        photoUrl: a.avatar?.url,
        instagram: a.instagram,
        active: a.active !== false,
        newsCount: newsMock.filter((n) => n.authors.some((x) => x.slug === a.slug)).length,
        member: member && { id: member.id, name: member.name },
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.newsCount - a.newsCount);
}
