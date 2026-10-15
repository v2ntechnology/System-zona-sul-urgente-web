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
  "ads.manage",
  "analytics.view",
  "analytics.ads.view",
  "users.manage",
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
    "analytics.view",
  ],
  REPORTER: [
    "news.create",
    "news.edit.own",
    "news.mark_urgent",
    "instagram.review",
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

export function can(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
