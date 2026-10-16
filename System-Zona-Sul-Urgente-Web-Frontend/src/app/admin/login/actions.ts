"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { adminRoutes } from "@/config/admin-navigation";
import { baseCookie, CHALLENGE_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";
import { apiBaseUrl } from "@/services/api/client";
import { authApi, type LoginResponse } from "@/services/admin/auth-api";

// Login do painel (BE-006, BFF). Server Actions: o Next confere a Origin da requisição
// (proteção CSRF nativa) e os tokens só existem em cookies HttpOnly.

export type LoginState =
  | { step: "credentials"; error?: string }
  | { step: "code"; email: string; setup?: { secret: string; qrSvg: string }; error?: string }
  /** Sem API configurada: o formulário segue no modo demonstração. */
  | { step: "demo" };

/** Só caminhos internos do painel (evita redirecionar para site externo). */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return /^\/admin(\/[\w\-/]*)?$/.test(value) && !value.startsWith("/admin/login")
    ? value
    : adminRoutes.dashboard;
}

/** Apagar cookie __Host- exige os mesmos atributos (Secure, Path=/), senão o navegador ignora. */
function clear(jar: Awaited<ReturnType<typeof cookies>>, name: string) {
  jar.set(name, "", { ...baseCookie, maxAge: 0 });
}

async function startSession(session: { token: string; expiresAt: string }) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.token, { ...baseCookie, expires: new Date(session.expiresAt) });
  clear(jar, CHALLENGE_COOKIE);
}

async function handle(result: LoginResponse, email: string, next: string): Promise<LoginState> {
  if (result.status === "AUTHENTICATED") {
    await startSession(result.session);
    redirect(next);
  }
  (await cookies()).set(CHALLENGE_COOKIE, result.challenge, {
    ...baseCookie,
    expires: new Date(result.challengeExpiresAt),
  });
  const setup = result.totpSetup
    ? {
        secret: result.totpSetup.secret,
        qrSvg: await QRCode.toString(result.totpSetup.otpauthUri, { type: "svg", margin: 1 }),
      }
    : undefined;
  return { step: "code", email, setup };
}

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  if (!apiBaseUrl()) return { step: "demo" };
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { step: "credentials", error: "Informe um e-mail válido." };
  }
  if (!password) return { step: "credentials", error: "Informe a senha." };
  const result = await authApi.login(email, password);
  if (!result.ok) return { step: "credentials", error: result.message };
  return handle(result.data, email, safeNext(form.get("next")));
}

export async function codeAction(state: LoginState, form: FormData): Promise<LoginState> {
  if (!apiBaseUrl()) return { step: "demo" };
  const email = state.step === "code" ? state.email : "";
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) {
    return { ...(state as Extract<LoginState, { step: "code" }>), error: "Digite os 6 números." };
  }
  const challenge = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!challenge) {
    return { step: "credentials", error: "O tempo para digitar o código acabou. Entre de novo." };
  }
  const result = await authApi.code(challenge, code);
  if (!result.ok) {
    // Desafio vencido ou com tentativas demais: volta ao começo.
    if (result.message.includes("Entre de novo")) {
      return { step: "credentials", error: result.message };
    }
    return { ...(state as Extract<LoginState, { step: "code" }>), error: result.message };
  }
  return handle(result.data, email, safeNext(form.get("next")));
}

/** Sair: encerra a sessão na API (não só o cookie) e volta ao login. */
export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await authApi.logout(token);
  clear(jar, SESSION_COOKIE);
  redirect(adminRoutes.login);
}
