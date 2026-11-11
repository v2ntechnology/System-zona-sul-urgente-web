// Consentimento de cookies (FE-122, LGPD — ARCHITECTURE §16). Só os essenciais rodam sem
// consentimento; publicidade (AdSense) só carrega depois do "Aceitar". A escolha fica num
// cookie lido no navegador: ler no servidor tornaria as páginas públicas dinâmicas.

export const CONSENT_COOKIE = "zsu_consent";
/** Sobe quando o texto/as categorias do aviso mudam: todo mundo é perguntado de novo. */
export const CONSENT_VERSION = 1;
/** 6 meses: depois disso o aviso volta. */
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60;
/** Disparado ao mudar a escolha (detail = ConsentChoice). */
export const CONSENT_EVENT = "zsu:consent";
/** Pede para reabrir o aviso ("Preferências de cookies" no rodapé). */
export const CONSENT_OPEN_EVENT = "zsu:consent-open";

/** "all" = aceitou tudo (inclui publicidade); "essential" = só o necessário. */
export type ConsentChoice = "all" | "essential";

/** Lê a escolha de um texto de cookies (document.cookie). null = ainda não escolheu. */
export function parseConsent(cookies: string): ConsentChoice | null {
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)`));
  if (!match) return null;
  const [version, choice] = decodeURIComponent(match[1]).split(".");
  if (Number(version) !== CONSENT_VERSION) return null;
  return choice === "all" || choice === "essential" ? choice : null;
}

/** Valor para document.cookie. Secure só em https (localhost em http também precisa gravar). */
export function consentCookie(choice: ConsentChoice, secure: boolean): string {
  return [
    `${CONSENT_COOKIE}=${CONSENT_VERSION}.${choice}`,
    `Max-Age=${CONSENT_MAX_AGE}`,
    "Path=/",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function adsAllowed(choice: ConsentChoice | null): boolean {
  return choice === "all";
}
