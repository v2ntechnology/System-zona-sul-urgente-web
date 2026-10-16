import { RESERVED_SLUGS } from "@/config/navigation";
import { newTagError, tagKey } from "@/lib/editor/tags";
import type { SectionColor } from "@/types/news";

// Regras de editorias e tópicos (FE-158). Rodam no navegador; a API valida de novo.

export type CategoryDraft = {
  id?: string;
  name: string;
  slug: string;
  /** Vazio = editoria principal. */
  parentSlug: string;
  color: SectionColor | "";
  inBar: boolean;
  whatsappUrl: string;
  description: string;
};

export type CategoryErrors = Partial<Record<keyof CategoryDraft, string>>;

type ExistingCategory = { id: string; slug: string; parentSlug?: string; inBar?: boolean };

export const CATEGORY_LIMITS = { name: 40, slug: 40, description: 160, inBar: 8 };
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WHATSAPP = /^https:\/\/(whatsapp\.com\/channel|chat\.whatsapp\.com)\/[\w-]+/;

export function validateCategory(
  draft: CategoryDraft,
  existing: ExistingCategory[],
): CategoryErrors {
  const errors: CategoryErrors = {};
  const others = existing.filter((c) => c.id !== draft.id);
  const name = draft.name.trim();
  if (name.length < 2) errors.name = "Dê um nome (2+ letras).";
  else if (name.length > CATEGORY_LIMITS.name)
    errors.name = `No máximo ${CATEGORY_LIMITS.name} caracteres.`;

  if (!SLUG.test(draft.slug))
    errors.slug = "Use só letras minúsculas, números e hífen (ex.: meio-ambiente).";
  else if (draft.slug.length > CATEGORY_LIMITS.slug)
    errors.slug = `No máximo ${CATEGORY_LIMITS.slug} caracteres.`;
  else if (!draft.parentSlug && RESERVED_SLUGS.has(draft.slug))
    errors.slug = `“/${draft.slug}” é usado por uma página fixa do site.`;
  else if (others.some((c) => c.slug === draft.slug))
    errors.slug = "Já existe uma editoria com esse endereço.";

  if (draft.parentSlug) {
    const parent = existing.find((c) => c.slug === draft.parentSlug);
    if (!parent || parent.parentSlug)
      errors.parentSlug = "A editoria mãe precisa ser uma editoria principal.";
    else if (
      draft.id &&
      others.some((c) => c.parentSlug === existing.find((e) => e.id === draft.id)?.slug)
    )
      errors.parentSlug = "Esta editoria tem subeditorias; ela não pode virar subeditoria.";
  } else if (!draft.color) errors.color = "Escolha a cor da editoria.";

  if (draft.inBar && !draft.parentSlug) {
    const inBar = others.filter((c) => c.inBar && !c.parentSlug).length;
    if (inBar >= CATEGORY_LIMITS.inBar)
      errors.inBar = `A barra comporta até ${CATEGORY_LIMITS.inBar} editorias; tire uma antes.`;
  }
  if (draft.whatsappUrl && !WHATSAPP.test(draft.whatsappUrl.trim()))
    errors.whatsappUrl = "Use o link do canal (https://whatsapp.com/channel/...).";
  if (draft.description.length > CATEGORY_LIMITS.description)
    errors.description = `No máximo ${CATEGORY_LIMITS.description} caracteres.`;
  return errors;
}

/** Tópicos com o mesmo nome normalizado (acento, caixa, plural): candidatos a juntar. */
export function duplicateGroups<T extends { id: string; name: string }>(tags: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const tag of tags) {
    const key = tagKey(tag.name);
    groups.set(key, [...(groups.get(key) ?? []), tag]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Erro ao renomear um tópico (nome inválido ou igual a outro existente). */
export function renameTagError(
  name: string,
  id: string,
  tags: { id: string; name: string }[],
): string | null {
  const problem = newTagError(name);
  if (problem) return problem;
  const clash = tags.find((t) => t.id !== id && tagKey(t.name) === tagKey(name));
  return clash ? `Já existe “${clash.name}”. Para unir os dois, use “Juntar”.` : null;
}
