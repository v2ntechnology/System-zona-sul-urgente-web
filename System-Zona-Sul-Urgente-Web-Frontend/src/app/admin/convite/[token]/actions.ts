"use server";

import { authApi } from "@/services/admin/auth-api";

export type AcceptState = { ok: true; email: string } | { ok: false; error: string };

/** Cria a senha de quem foi convidado (FE-159). Depois a pessoa entra pelo login normal. */
export async function acceptInviteAction(token: string, password: string): Promise<AcceptState> {
  const result = await authApi.acceptInvite(token, password);
  return result.ok ? { ok: true, email: result.data.email } : { ok: false, error: result.message };
}
