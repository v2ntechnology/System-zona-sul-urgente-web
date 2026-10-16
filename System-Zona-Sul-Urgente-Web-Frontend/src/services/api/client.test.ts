import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiGetOrBadRequest, unwrap } from "@/services/api/client";
import { ServiceError } from "@/services/errors";

const respond = (status: number, body?: unknown) =>
  vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));

describe("cliente da API pública", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("monta a URL, ignora parâmetros vazios e devolve o JSON", async () => {
    vi.stubEnv("API_URL", "http://api:8080/");
    const fetchMock = respond(200, { items: [] });
    vi.stubGlobal("fetch", fetchMock);
    expect(await apiGet("/news", { limit: 5, cursor: null, q: "" })).toEqual({ items: [] });
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://api:8080/api/v1/public/news?limit=5");
  });

  it("404 e 204 viram null", async () => {
    vi.stubEnv("API_URL", "http://api:8080");
    vi.stubGlobal("fetch", respond(404, { title: "Não encontrado" }));
    expect(await apiGet("/news/x")).toBeNull();
    vi.stubGlobal("fetch", respond(204));
    expect(await apiGet("/news/featured")).toBeNull();
  });

  it("400 vira valor (para o cache) e unwrap transforma em ServiceError", async () => {
    vi.stubEnv("API_URL", "http://api:8080");
    vi.stubGlobal("fetch", respond(400, { detail: "Cursor de paginação inválido." }));
    const value = await apiGetOrBadRequest("/news", { cursor: "lixo" });
    expect(value).toEqual({ badRequest: "Cursor de paginação inválido." });
    expect(() => unwrap(value)).toThrow(ServiceError);
  });

  it("API fora do ar ou 5xx vira UNAVAILABLE", async () => {
    vi.stubEnv("API_URL", "http://api:8080");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(apiGet("/news")).rejects.toMatchObject({ code: "UNAVAILABLE" });
    vi.stubGlobal("fetch", respond(503, {}));
    await expect(apiGet("/news")).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
