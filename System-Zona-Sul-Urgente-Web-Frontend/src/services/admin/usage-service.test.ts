import { afterEach, describe, expect, it, vi } from "vitest";

import { alertsFrom, getUsage, getUsageAlerts } from "@/services/admin/usage-service";
import type { UsageResource } from "@/types/admin";

// Com API_URL o service lê o cookie de sessão; aqui ele é simulado.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token-de-teste" }) }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("usage-service (demonstração)", () => {
  it("traz os recursos no formato do contrato", async () => {
    const report = await getUsage();
    expect(report).not.toBeNull();
    expect(report!.warnAt).toBe(70);
    expect(report!.criticalAt).toBe(90);
    const keys = report!.resources.map((r) => r.key);
    expect(keys).toContain("fotos.espaco");
    expect(keys.some((k) => k.startsWith("ia."))).toBe(true);
    expect(keys).toContain("disco");
    const fotos = report!.resources.find((r) => r.key === "fotos.espaco")!;
    expect(fotos).toMatchObject({ unit: "BYTES", source: "cloud", lockAt: 95, resetsAt: null });
    expect(fotos.used / fotos.limit!).toBeCloseTo(0.12, 2);
  });

  it("os avisos são só os recursos fora do normal", async () => {
    const alerts = await getUsageAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.level !== "NORMAL" || a.locked)).toBe(true);
    expect(alerts[0]).toEqual({
      key: expect.any(String),
      label: expect.any(String),
      percent: expect.any(Number),
      level: "WARN",
      locked: false,
    });
  });

  it("recurso travado entra nos avisos mesmo no nível normal", () => {
    const base = { level: "NORMAL", locked: false } as UsageResource;
    expect(
      alertsFrom([
        { ...base, key: "a", label: "A", percent: 10 },
        { ...base, key: "b", label: "B", percent: 50, locked: true },
        { ...base, key: "c", label: "C", percent: 92, level: "CRITICAL" },
      ]).map((a) => a.key),
    ).toEqual(["b", "c"]);
  });
});

describe("usage-service (com a API)", () => {
  it("busca a faixa em /admin/usage/alerts com a sessão, sem cache", async () => {
    vi.stubEnv("API_URL", "http://api.teste");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              key: "fotos.espaco",
              label: "Fotos — espaço",
              percent: 91.5,
              level: "CRITICAL",
              locked: false,
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const alerts = await getUsageAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("CRITICAL");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://api.teste/api/v1/admin/usage/alerts");
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer token-de-teste");
  });

  it("falha ao buscar a faixa vira lista vazia (nunca quebra o painel)", async () => {
    vi.stubEnv("API_URL", "http://api.teste");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    expect(await getUsageAlerts()).toEqual([]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    expect(await getUsageAlerts()).toEqual([]);

    // 403 (perfil sem settings.manage) também não mostra nada.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ title: "Proibido" }), { status: 403 })),
    );
    expect(await getUsageAlerts()).toEqual([]);
  });

  it("404 na tela = monitor inexistente (null)", async () => {
    vi.stubEnv("API_URL", "http://api.teste");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ title: "Não encontrado" }), { status: 404 })),
    );
    expect(await getUsage()).toBeNull();
  });
});
