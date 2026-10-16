// Cookies do login do painel (BFF, ARCHITECTURE §8). O prefixo __Host- obriga Secure, Path=/
// e nenhum Domain: o cookie só vale para este endereço exato. HttpOnly: o JavaScript da
// página nunca lê os tokens.
export const SESSION_COOKIE = "__Host-zsu_session";
/** Desafio da 2ª etapa (código do app autenticador): vale 5 minutos. */
export const CHALLENGE_COOKIE = "__Host-zsu_mfa";

export const baseCookie = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};
