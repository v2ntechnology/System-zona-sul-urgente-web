"use server";

import { can } from "@/config/permissions";
import { validateDraft } from "@/lib/editor/validate";
import { getCurrentUser } from "@/services/admin/admin-service";
import type { NewsDraft, SaveIntent, SaveResult } from "@/types/admin";
import type { NewsStatus } from "@/types/news";

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

  return {
    ok: true,
    id: draft.id ?? crypto.randomUUID(),
    status: nextStatus[intent],
    savedAt: new Date().toISOString(),
    simulated: true,
  };
}
