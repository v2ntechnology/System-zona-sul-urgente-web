"use server";

import type { ManagedCategory } from "@/components/admin/taxonomy/categories-manager";
import type { ManagedTag } from "@/components/admin/taxonomy/tags-manager";
import type { CategoryDraft } from "@/lib/taxonomy/validate";
import { adminFetch, type AdminResult } from "@/services/admin/admin-api";
import {
  type AdminTag,
  type ApiCategory,
  fromApiCategories,
} from "@/services/admin/taxonomy-admin-service";
import { apiBaseUrl } from "@/services/api/client";

// Editorias e tópicos (FE-158) na API. Cada ação devolve a lista inteira atualizada; a tela
// troca a dela. Sem API: { ok: false, message: "simulated" } e a tela simula a mudança.
// Permissões: a API confere (taxonomy.manage / tags.manage); o site é avisado pela própria API.

export type ListResult<T> =
  { ok: true; list: T[] } | { ok: false; message: string; errors?: Record<string, string> };

const SIMULATED = { ok: false, message: "simulated" } as const;

function toList<A, T>(result: AdminResult<A[]>, map: (list: A[]) => T[]): ListResult<T> {
  if (result.ok) return { ok: true, list: map(result.data) };
  return {
    ok: false,
    message: result.message,
    errors: result.errors && Object.fromEntries(result.errors.map((e) => [e.field, e.message])),
  };
}

function managedCategories(list: ApiCategory[]): ManagedCategory[] {
  return fromApiCategories(list).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentSlug: c.parent?.slug,
    color: c.color,
    inBar: Boolean(c.inBar),
    active: c.active !== false,
    order: c.order ?? 999,
    whatsappUrl: c.whatsappUrl ?? "",
    description: c.description ?? "",
    newsCount: c.newsCount,
  }));
}

const managedTags = (list: AdminTag[]): ManagedTag[] =>
  list.map((t) => ({ ...t, active: t.active ?? true }));

async function categories(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<ListResult<ManagedCategory>> {
  if (!apiBaseUrl()) return SIMULATED;
  return toList(await adminFetch<ApiCategory[]>(path, { method, body }), managedCategories);
}

async function tags(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
): Promise<ListResult<ManagedTag>> {
  if (!apiBaseUrl()) return SIMULATED;
  return toList(await adminFetch<AdminTag[]>(path, { method, body }), managedTags);
}

export async function saveCategoryAction(draft: CategoryDraft) {
  const body = {
    name: draft.name,
    slug: draft.slug,
    parentSlug: draft.parentSlug,
    color: draft.color,
    inBar: draft.inBar,
    whatsappUrl: draft.whatsappUrl,
    description: draft.description,
  };
  return draft.id
    ? categories(`/categories/${draft.id}`, "PUT", body)
    : categories("/categories", "POST", body);
}

export async function moveCategoryAction(id: string, direction: -1 | 1) {
  return categories(`/categories/${id}/move`, "POST", { direction });
}

export async function setCategoryActiveAction(id: string, active: boolean) {
  return categories(`/categories/${id}/active`, "POST", { active });
}

export async function deleteCategoryAction(id: string) {
  return categories(`/categories/${id}`, "DELETE");
}

export async function renameTagAction(id: string, name: string) {
  return tags(`/tags/${id}`, "PUT", { name });
}

export async function setTagActiveAction(id: string, active: boolean) {
  return tags(`/tags/${id}/active`, "POST", { active });
}

export async function mergeTagsAction(keepId: string, mergeIds: string[]) {
  return tags("/tags/merge", "POST", { keepId, mergeIds });
}
