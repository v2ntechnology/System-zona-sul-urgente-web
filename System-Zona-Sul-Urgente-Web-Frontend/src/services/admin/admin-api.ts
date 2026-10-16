import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { adminRoutes } from "@/config/admin-navigation";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { apiBaseUrl } from "@/services/api/client";

// Chamadas autenticadas a /api/v1/admin/** (BFF): o servidor do Next lê o cookie de sessão
// e repassa como Bearer. Sessão vencida/revogada (401) → tela de login. Nunca em cache:
// cada resposta depende de quem está logado.

export type FieldProblem = { field: string; message: string };

export type AdminResult<T> =
  { ok: true; data: T } | { ok: false; status: number; message: string; errors?: FieldProblem[] };

export async function adminFetch<T>(
  path: string,
  init: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    /** Envio de arquivo (multipart); o fetch monta o boundary sozinho. */
    form?: FormData;
    params?: Record<string, unknown>;
    timeoutMs?: number;
  } = {},
): Promise<AdminResult<T>> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, status: 503, message: "API não configurada." };
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect(adminRoutes.login);

  const url = new URL(`${base}/api/v1/admin${path}`);
  for (const [key, value] of Object.entries(init.params ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 10_000),
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        ...(init.body !== undefined && { "content-type": "application/json" }),
      },
      body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    });
  } catch {
    return {
      ok: false,
      status: 503,
      message: "O servidor não respondeu. Tente de novo em instantes.",
    };
  }
  if (response.status === 401) redirect(adminRoutes.login);
  const json = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const problem = (json ?? {}) as { detail?: string; title?: string; errors?: FieldProblem[] };
    return {
      ok: false,
      status: response.status,
      message: problem.detail ?? problem.title ?? `Erro ${response.status}.`,
      errors: problem.errors,
    };
  }
  return { ok: true, data: json as T };
}

/** Atalho para leituras: erro vira exceção (a página mostra o error.tsx). */
export async function adminGet<T>(
  path: string,
  params?: Record<string, unknown>,
): Promise<T | null> {
  const result = await adminFetch<T>(path, { params });
  if (result.ok) return result.data;
  if (result.status === 404) return null;
  throw new Error(result.message);
}
