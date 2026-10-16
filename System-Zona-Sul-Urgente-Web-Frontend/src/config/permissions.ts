import type { Permission, Role } from "@/types/admin";

// Matriz de permissões (ARCHITECTURE §8). Espelho da regra do backend, usada só para a
// interface não oferecer o que o perfil não pode fazer — a API é quem garante.
const ALL: Permission[] = [
  "news.create",
  "news.edit.own",
  "news.edit.any",
  "news.publish",
  "news.delete",
  "news.mark_urgent",
  "news.mark_sponsored",
  "instagram.review",
  "instagram.settings",
  "taxonomy.manage",
  "tags.manage",
  "ads.manage",
  "analytics.view",
  "analytics.ads.view",
  "users.manage",
  "authors.manage",
  "settings.manage",
  "audit.view",
];

export const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: ALL,
  EDITOR: [
    "news.create",
    "news.edit.own",
    "news.edit.any",
    "news.publish",
    "news.delete",
    "news.mark_urgent",
    "news.mark_sponsored",
    "instagram.review",
    "taxonomy.manage",
    "tags.manage",
    "authors.manage",
    "analytics.view",
  ],
  REPORTER: [
    "news.create",
    "news.edit.own",
    "news.mark_urgent",
    "instagram.review",
    "tags.manage",
    "analytics.view",
  ],
  COMERCIAL: [
    "news.create",
    "news.edit.own",
    "news.mark_sponsored",
    "ads.manage",
    "analytics.ads.view",
  ],
  AUTOR: ["news.create", "news.edit.own", "analytics.view"],
};

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
  REPORTER: "Repórter",
  COMERCIAL: "Comercial",
  AUTOR: "Autor/Colunista",
};

/** O que cada perfil faz, em uma linha (convite e troca de perfil). */
export const roleDescriptions: Record<Role, string> = {
  ADMIN: "Tudo, inclusive equipe, publicidade e configurações.",
  EDITOR: "Publica, edita qualquer matéria, revisa o Instagram e cuida de editorias e autores.",
  REPORTER: "Escreve e envia para revisão; marca urgente e revisa o Instagram.",
  COMERCIAL: "Publicidade e matérias patrocinadas (publicadas por um editor).",
  AUTOR: "Colunista ou colaborador: escreve só as próprias matérias.",
};

/** Perfis que exigem 2FA (ARCHITECTURE §8). */
export const TWO_FACTOR_ROLES = new Set<Role>(["ADMIN", "EDITOR", "COMERCIAL"]);

export function can(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
