"use server";

import { formatTime } from "@/lib/format";
import { adminFetch } from "@/services/admin/admin-api";
import { apiBaseUrl } from "@/services/api/client";
import type { InstagramConnection, InstagramPost } from "@/types/admin";

// Ações da fila do Instagram (FE-155) na API. Cada uma devolve o post atualizado; a tela troca o dela.
// Sem API: { ok: false, message: "simulated" } e a tela simula como antes. A API confere a permissão
// (instagram.review) e cria a notícia em rascunho com a IA (BE-014).

export type InstagramAction = "generate" | "reprocess" | "ignore" | "restore" | "acknowledge";

export type PostResult =
  | { ok: true; post: InstagramPost }
  | {
      ok: false;
      message: string;
      errors?: Record<string, string>;
      /** 429 "Limite da IA" (spec 004): a geração foi enfileirada para esta hora. */
      retryAt?: string;
    };

const SIMULATED = { ok: false, message: "simulated" } as const;

/** A IA leva alguns segundos (às vezes dezenas, no plano grátis). */
const AI_TIMEOUT_MS = 90_000;

function toResult(result: Awaited<ReturnType<typeof adminFetch<InstagramPost>>>): PostResult {
  if (result.ok) return { ok: true, post: result.data };
  if (
    result.status === 429 &&
    (result.problem?.title === "Limite da IA" || result.problem?.retryAt)
  )
    return aiLimit(result.problem?.retryAt);
  return {
    ok: false,
    message: result.message,
    errors: result.errors && Object.fromEntries(result.errors.map((e) => [e.field, e.message])),
  };
}

/**
 * 429 "Limite da IA" (spec 004): a cota do minuto ou do dia acabou e a API já enfileirou a geração
 * para `retryAt` — o rascunho sai sozinho, sem erro e sem custo.
 */
function aiLimit(retryAt: unknown): PostResult {
  const when = typeof retryAt === "string" && !Number.isNaN(Date.parse(retryAt)) ? retryAt : null;
  return {
    ok: false,
    message: when
      ? `Limite da IA: o rascunho entrou na fila e sai sozinho às ${formatTime(when)}.`
      : "Limite da IA: o rascunho entrou na fila e sai sozinho quando a cota voltar.",
    retryAt: when ?? undefined,
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

// ------------------------------------------------------------------ conta do Instagram (spec 001)

export type ConnectionResult =
  | { ok: true; connection: InstagramConnection }
  | { ok: false; message: string; errors?: Record<string, string> };

/**
 * Liga ou troca a conta (só Administrador: a API confere instagram.settings). O acesso só passa
 * por aqui a caminho da API; nunca volta para o navegador.
 */
export async function connectInstagram(input: {
  igUserId: string;
  accessToken: string;
}): Promise<ConnectionResult> {
  if (!apiBaseUrl()) return SIMULATED;
  const result = await adminFetch<InstagramConnection>("/instagram/connection", {
    method: "PUT",
    body: { igUserId: input.igUserId.trim(), accessToken: input.accessToken.trim() },
    timeoutMs: 30_000,
  });
  if (result.ok) return { ok: true, connection: result.data };
  return {
    ok: false,
    message: result.message,
    errors: result.errors && Object.fromEntries(result.errors.map((e) => [e.field, e.message])),
  };
}

/** Desliga a conta: a sincronização para; posts e notícias continuam. */
export async function disconnectInstagram(): Promise<{ ok: boolean; message?: string }> {
  if (!apiBaseUrl()) return SIMULATED;
  const result = await adminFetch<void>("/instagram/connection", { method: "DELETE" });
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

/** "Sincronizar agora": varredura fora do ciclo de 15 min (só Administrador). */
export async function syncInstagramNow(): Promise<ConnectionResult> {
  if (!apiBaseUrl()) return SIMULATED;
  const result = await adminFetch<InstagramConnection>("/instagram/connection/sync", {
    method: "POST",
    timeoutMs: 60_000,
  });
  return result.ok ? { ok: true, connection: result.data } : { ok: false, message: result.message };
}
