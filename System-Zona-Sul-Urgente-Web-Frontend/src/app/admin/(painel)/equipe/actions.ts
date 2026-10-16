"use server";

import type { ListResult } from "@/app/admin/(painel)/editorias/actions";
import { adminRoutes } from "@/config/admin-navigation";
import { siteConfig } from "@/config/site";
import { adminFetch, type AdminResult } from "@/services/admin/admin-api";
import { apiBaseUrl } from "@/services/api/client";
import type { AuthorProfile, Role, TeamMember } from "@/types/admin";

// Equipe e autores (FE-159) na API. Cada ação devolve a lista inteira atualizada; sem API:
// { ok: false, message: "simulated" } e a tela simula. A API confere as permissões e as
// regras (ninguém mexe no próprio acesso, sempre sobra um Administrador ativo).

const SIMULATED = { ok: false, message: "simulated" } as const;

function toList<T>(result: AdminResult<T[]>): ListResult<T> {
  if (result.ok) return { ok: true, list: result.data };
  return {
    ok: false,
    message: result.message,
    errors: result.errors && Object.fromEntries(result.errors.map((e) => [e.field, e.message])),
  };
}

async function team(path: string, body: unknown = {}): Promise<ListResult<TeamMember>> {
  if (!apiBaseUrl()) return SIMULATED;
  return toList(await adminFetch<TeamMember[]>(path, { method: "POST", body }));
}

async function authors(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
): Promise<ListResult<AuthorProfile>> {
  if (!apiBaseUrl()) return SIMULATED;
  return toList(await adminFetch<AuthorProfile[]>(path, { method, body }));
}

export type InviteResult =
  | { ok: true; list: TeamMember[]; inviteUrl: string; expiresAt: string }
  | { ok: false; message: string; errors?: Record<string, string> };

type ApiInvited = { team: TeamMember[]; inviteToken: string; expiresAt: string };

/** Link que o administrador manda para a pessoa (ainda sem serviço de e-mail). */
const inviteUrl = (token: string) => `${siteConfig.url}${adminRoutes.invite(token)}`;

function invited(result: AdminResult<ApiInvited>): InviteResult {
  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      errors: result.errors && Object.fromEntries(result.errors.map((e) => [e.field, e.message])),
    };
  }
  return {
    ok: true,
    list: result.data.team,
    inviteUrl: inviteUrl(result.data.inviteToken),
    expiresAt: result.data.expiresAt,
  };
}

export async function inviteMemberAction(input: {
  name: string;
  email: string;
  role: Role;
  createAuthor: boolean;
}): Promise<InviteResult> {
  if (!apiBaseUrl()) return SIMULATED;
  return invited(await adminFetch<ApiInvited>("/users/invite", { method: "POST", body: input }));
}

export async function reinviteMemberAction(id: string): Promise<InviteResult> {
  if (!apiBaseUrl()) return SIMULATED;
  return invited(await adminFetch<ApiInvited>(`/users/${id}/invite`, { method: "POST", body: {} }));
}

export async function changeRoleAction(id: string, role: Role) {
  return team(`/users/${id}/role`, { role });
}

export async function setMemberActiveAction(id: string, active: boolean) {
  return team(`/users/${id}/active`, { active });
}

export async function resetTwoFactorAction(id: string) {
  return team(`/users/${id}/reset-2fa`);
}

export async function saveAuthorAction(draft: {
  id?: string;
  name: string;
  role: string;
  bio: string;
  instagram: string;
}) {
  const body = { name: draft.name, role: draft.role, bio: draft.bio, instagram: draft.instagram };
  return draft.id
    ? authors(`/authors/${draft.id}`, "PUT", body)
    : authors("/authors", "POST", body);
}

export async function setAuthorActiveAction(id: string, active: boolean) {
  return authors(`/authors/${id}/active`, "POST", { active });
}
