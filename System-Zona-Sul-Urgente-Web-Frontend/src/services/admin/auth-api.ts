import { headers } from "next/headers";

import { apiBaseUrl } from "@/services/api/client";
import type { Role } from "@/types/admin";

// Chamadas de autenticação à API (BE-006). Só no servidor do Next (BFF): o navegador fala com
// o Next; o Next fala com a API pela rede interna e repassa o IP real para o bloqueio por
// tentativas e a auditoria.

export type LoginResponse =
  | { status: "AUTHENTICATED"; session: { token: string; expiresAt: string } }
  | {
      status: "MFA_REQUIRED" | "MFA_SETUP_REQUIRED";
      challenge: string;
      challengeExpiresAt: string;
      totpSetup?: { secret: string; otpauthUri: string };
    };

export type Me = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  authorSlug?: string;
};

export type AuthResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function clientHeaders(): Promise<Record<string, string>> {
  const h = await headers();
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip");
  return {
    ...(ip && { "X-Client-IP": ip }),
    ...(h.get("user-agent") && { "X-Client-User-Agent": h.get("user-agent")!.slice(0, 300) }),
  };
}

async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; token?: string },
): Promise<AuthResult<T>> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, status: 503, message: "API não configurada." };
  try {
    const response = await fetch(`${base}/api/v1/admin/auth${path}`, {
      method: init.method,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      headers: {
        accept: "application/json",
        ...(init.body !== undefined && { "content-type": "application/json" }),
        ...(init.token && { authorization: `Bearer ${init.token}` }),
        ...(await clientHeaders()),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (response.status === 204) return { ok: true, data: undefined as T };
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const problem = json as { detail?: string; errors?: { message: string }[] };
      return {
        ok: false,
        status: response.status,
        message: problem.errors?.[0]?.message ?? problem.detail ?? "Não foi possível entrar.",
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return {
      ok: false,
      status: 503,
      message: "O servidor não respondeu. Tente de novo em instantes.",
    };
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    call<LoginResponse>("/login", { method: "POST", body: { email, password } }),
  code: (challenge: string, code: string) =>
    call<LoginResponse>("/mfa", { method: "POST", body: { challenge, code } }),
  logout: (token: string) => call<void>("/logout", { method: "POST", token }),
  me: (token: string) => call<Me>("/me", { method: "GET", token }),
  /** Convite da equipe (FE-159): o token do link é a credencial. */
  checkInvite: (token: string) =>
    call<{ name: string; email: string }>("/invite/check", { method: "POST", body: { token } }),
  acceptInvite: (token: string, password: string) =>
    call<{ name: string; email: string }>("/invite/accept", {
      method: "POST",
      body: { token, password },
    }),
};
