import { ServiceError } from "@/services/errors";

// Cliente da API pública (BE-004). Só roda no servidor: o navegador nunca fala com a API
// direto (ARCHITECTURE: Next é o BFF). Sem API_URL configurada, os services usam os dados
// de exemplo (src/mocks) — assim o build e o dev funcionam sem o backend no ar.

const TIMEOUT_MS = 5_000;

/** Endereço base da API, ou undefined quando não configurada (modo dados de exemplo). */
export function apiBaseUrl(): string | undefined {
  return process.env.API_URL?.replace(/\/+$/, "") || undefined;
}

type Params = Record<string, string | number | null | undefined>;

/**
 * 400 devolvido como valor (e não exceção) pelas funções em `use cache`: em produção o Next
 * troca exceções lançadas dentro do cache por um erro genérico, e a classe ServiceError se
 * perderia. O service, fora do cache, transforma isto de volta em ServiceError (unwrap).
 */
export type BadRequest = { badRequest: string };

export function unwrap<T>(value: T | BadRequest): T {
  if (value && typeof value === "object" && "badRequest" in value) {
    throw new ServiceError(value.badRequest, "BAD_REQUEST");
  }
  return value as T;
}

/**
 * GET em /api/v1/public{path}. 404 e 204 viram `null` (o service decide: página chama
 * notFound()). 400 vira ServiceError BAD_REQUEST (ex.: cursor adulterado); o resto, UNAVAILABLE.
 */
export async function apiGet<T>(path: string, params: Params = {}): Promise<T | null> {
  const result = await apiGetOrBadRequest<T>(path, params);
  return unwrap(result);
}

/** Igual a apiGet, mas devolve o 400 como valor (para funções em `use cache`). */
export async function apiGetOrBadRequest<T>(
  path: string,
  params: Params = {},
): Promise<T | null | BadRequest> {
  const base = apiBaseUrl();
  if (!base) throw new ServiceError("API_URL não configurada.", "UNEXPECTED");
  const url = new URL(`${base}/api/v1/public${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new ServiceError("A API não respondeu.", "UNAVAILABLE", error);
  }

  if (response.status === 404 || response.status === 204) return null;
  if (response.status === 400) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string };
    return { badRequest: problem.detail ?? "Requisição inválida." };
  }
  if (!response.ok) {
    throw new ServiceError(`A API respondeu ${response.status}.`, "UNAVAILABLE");
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ServiceError("Resposta inválida da API.", "UNEXPECTED", error);
  }
}
