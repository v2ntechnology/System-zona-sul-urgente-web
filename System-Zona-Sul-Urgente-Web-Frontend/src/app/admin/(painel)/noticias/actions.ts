"use server";

import { revalidateTag } from "next/cache";

import { can } from "@/config/permissions";
import { cacheTags } from "@/lib/cache-tags";
import { validateDraft } from "@/lib/editor/validate";
import { adminFetch } from "@/services/admin/admin-api";
import { getCurrentUser } from "@/services/admin/admin-service";
import { apiBaseUrl } from "@/services/api/client";
import type { DraftErrors, NewsDraft, SaveIntent, SaveResult } from "@/types/admin";
import type { NewsStatus } from "@/types/news";

type ApiSaved = { id: string; slug: string; status: NewsStatus; version: number; savedAt: string };

/**
 * Atualiza o cache do site na hora (a ação roda no próprio Next). A API ainda vai avisar
 * por /api/revalidate (BE-011) para mudanças feitas fora do painel.
 */
function refreshSite(slug: string, categorySlug?: string) {
  for (const tag of [
    cacheTags.news(slug),
    cacheTags.newsList(),
    cacheTags.home(),
    cacheTags.breaking(),
    ...(categorySlug ? [cacheTags.category(categorySlug)] : []),
  ]) {
    revalidateTag(tag, { expire: 0 });
  }
}

export type NewsStateAction = "publish" | "unpublish" | "delete" | "restore";

/** Publicar, despublicar, mandar para a lixeira e restaurar (listagem do painel). */
export async function changeNewsStateAction(
  id: string,
  action: NewsStateAction,
): Promise<{ ok: true; status: NewsStatus } | { ok: false; message: string }> {
  if (!apiBaseUrl()) return { ok: false, message: "simulated" };
  const result = await adminFetch<ApiSaved>(
    action === "delete" ? `/news/${id}` : `/news/${id}/${action}`,
    { method: action === "delete" ? "DELETE" : "POST" },
  );
  if (!result.ok) return { ok: false, message: result.message };
  refreshSite(result.data.slug);
  return { ok: true, status: result.data.status };
}

const nextStatus: Record<SaveIntent, NewsStatus> = {
  draft: "DRAFT",
  review: "IN_REVIEW",
  publish: "PUBLISHED",
  schedule: "SCHEDULED",
};

/**
 * Salva a notícia (FE-154). Valida de novo no servidor e confere a permissão — o editor
 * no navegador pode ser adulterado. Sem backend, a gravação é SIMULADA (`simulated: true`);
 * com a API: POST/PUT /api/v1/admin/news + /publish, e revalidação do site (BE-011).
 * Tópicos novos (`newTags`) são criados pela API na mesma operação, reaproveitando um
 * existente se o nome normalizado já existir.
 */
export async function saveNewsAction(draft: NewsDraft, intent: SaveIntent): Promise<SaveResult> {
  const user = await getCurrentUser();

  if ((intent === "publish" || intent === "schedule") && !can(user.role, "news.publish")) {
    return { ok: false, errors: {}, message: "Seu perfil não pode publicar. Envie para revisão." };
  }
  if (draft.isSponsored && !can(user.role, "news.mark_sponsored")) {
    return {
      ok: false,
      errors: { isSponsored: "Sem permissão." },
      message: "Seu perfil não pode marcar matéria patrocinada.",
    };
  }
  if (draft.isUrgent && !can(user.role, "news.mark_urgent")) {
    return {
      ok: false,
      errors: { isUrgent: "Sem permissão." },
      message: "Seu perfil não pode marcar urgente.",
    };
  }

  if (draft.newTags?.length && !can(user.role, "tags.manage")) {
    return {
      ok: false,
      errors: { newTags: "Sem permissão." },
      message: "Seu perfil não pode criar tópicos. Escolha um existente.",
    };
  }

  const errors = validateDraft(draft, intent);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: "Revise os campos destacados." };
  }

  if (apiBaseUrl()) {
    const result = await adminFetch<ApiSaved>(draft.id ? `/news/${draft.id}` : "/news", {
      method: draft.id ? "PUT" : "POST",
      body: { intent, draft },
    });
    if (!result.ok) {
      return {
        ok: false,
        // A API usa os mesmos nomes de campo do editor ("image.alt", "categorySlug"...).
        errors: Object.fromEntries(
          (result.errors ?? []).map((e) => [e.field, e.message]),
        ) as DraftErrors,
        message: result.message,
      };
    }
    refreshSite(result.data.slug, draft.categorySlug);
    return { ok: true, ...result.data, simulated: false };
  }

  return {
    ok: true,
    id: draft.id ?? crypto.randomUUID(),
    status: nextStatus[intent],
    savedAt: new Date().toISOString(),
    simulated: true,
  };
}
