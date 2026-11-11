"use server";

import { adminFetch } from "@/services/admin/admin-api";
import { apiBaseUrl } from "@/services/api/client";
import type { InstagramPost } from "@/types/admin";

// Ações da fila do Instagram (FE-155) na API. Cada uma devolve o post atualizado; a tela troca o dela.
// Sem API: { ok: false, message: "simulated" } e a tela simula como antes. A API confere a permissão
// (instagram.review) e cria a notícia em rascunho com a IA (BE-014).

export type InstagramAction = "generate" | "reprocess" | "ignore" | "restore" | "acknowledge";

export type PostResult =
  | { ok: true; post: InstagramPost }
  | { ok: false; message: string; errors?: Record<string, string> };

const SIMULATED = { ok: false, message: "simulated" } as const;

/** A IA leva alguns segundos (às vezes dezenas, no plano grátis). */
const AI_TIMEOUT_MS = 90_000;

function toResult(result: Awaited<ReturnType<typeof adminFetch<InstagramPost>>>): PostResult {
  if (result.ok) return { ok: true, post: result.data };
  return {
    ok: false,
    message: result.message,
    errors: result.errors && Object.fromEntries(result.errors.map((e) => [e.field, e.message])),
  };
}

export async function runInstagramAction(id: string, action: InstagramAction): Promise<PostResult> {
  if (!apiBaseUrl()) return SIMULATED;
  // Reprocessar = pedir o rascunho de novo depois de um erro.
  const path = action === "reprocess" ? "generate" : action;
  const ai = path === "generate";
  return toResult(
    await adminFetch<InstagramPost>(`/instagram/posts/${encodeURIComponent(id)}/${path}`, {
      method: "POST",
      timeoutMs: ai ? AI_TIMEOUT_MS : undefined,
    }),
  );
}

/** Post colado no painel (link + legenda) enquanto a conta não está conectada pela Meta. */
export async function addInstagramPost(input: {
  url: string;
  caption: string;
}): Promise<PostResult> {
  if (!apiBaseUrl()) return SIMULATED;
  return toResult(
    await adminFetch<InstagramPost>("/instagram/posts", {
      method: "POST",
      body: { url: input.url.trim(), caption: input.caption },
    }),
  );
}
