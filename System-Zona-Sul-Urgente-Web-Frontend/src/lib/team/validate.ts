import { slugify } from "@/config/navigation";
import type { Role, TeamMember } from "@/types/admin";

// Regras da equipe (FE-159). A API garante; aqui a tela avisa antes.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function inviteErrors(
  input: { name: string; email: string; role: Role | "" },
  team: TeamMember[],
): Partial<Record<"name" | "email" | "role", string>> {
  const errors: Partial<Record<"name" | "email" | "role", string>> = {};
  if (input.name.trim().split(/\s+/).length < 2) errors.name = "Informe nome e sobrenome.";
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) errors.email = "E-mail inválido.";
  else if (team.some((m) => m.email.toLowerCase() === email))
    errors.email = "Essa pessoa já está na equipe (ou já foi convidada).";
  if (!input.role) errors.role = "Escolha o perfil de acesso.";
  return errors;
}

/**
 * Pode trocar o perfil ou desativar `target`? Ninguém mexe no próprio acesso e sempre
 * sobra pelo menos um ADMIN ativo. Devolve o motivo do bloqueio, ou null.
 */
export function accessChangeBlock(
  actorId: string,
  target: TeamMember,
  change: { role?: Role; disable?: boolean },
  team: TeamMember[],
): string | null {
  if (target.id === actorId) return "Você não pode alterar o seu próprio acesso.";
  const losesAdmin =
    target.role === "ADMIN" &&
    target.status === "ACTIVE" &&
    (change.disable || (change.role && change.role !== "ADMIN"));
  if (losesAdmin) {
    const admins = team.filter((m) => m.role === "ADMIN" && m.status === "ACTIVE");
    if (admins.length <= 1) return "Precisa sobrar pelo menos um Administrador ativo.";
  }
  return null;
}

/** Endereço do autor (página /autor/{slug}) a partir do nome, sem repetir os existentes. */
export function authorSlugFor(name: string, taken: string[]): string {
  const base = slugify(name) || "autor";
  let slug = base;
  for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`;
  return slug;
}
