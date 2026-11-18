"use server";

import { adminFetch } from "@/services/admin/admin-api";
import { apiBaseUrl } from "@/services/api/client";
import type { UsageReport } from "@/types/admin";

// "Atualizar agora" da tela Uso dos planos (spec 004): POST /api/v1/admin/usage/refresh lê a
// Cloudflare na hora e devolve o mesmo corpo do GET. A API confere a permissão (settings.manage) e
// aceita no máximo 1 por minuto (429 com retryAfterSeconds). Sem API: "simulated".

export type RefreshResult =
  { ok: true; report: UsageReport } | { ok: false; message: string; retryAfterSeconds?: number };

export async function refreshUsage(): Promise<RefreshResult> {
  if (!apiBaseUrl()) return { ok: false, message: "simulated" };
  const result = await adminFetch<UsageReport>("/usage/refresh", {
    method: "POST",
    // A leitura da nuvem pode levar alguns segundos.
    timeoutMs: 30_000,
  });
  if (result.ok) return { ok: true, report: result.data };
  if (result.status === 429) {
    const seconds = Number(result.problem?.retryAfterSeconds);
    const retryAfterSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
    return {
      ok: false,
      message: `Os números acabaram de ser lidos. Tente de novo em ${retryAfterSeconds} s.`,
      retryAfterSeconds,
    };
  }
  return { ok: false, message: result.message };
}
