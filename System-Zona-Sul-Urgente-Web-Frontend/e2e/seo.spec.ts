import { expect, HEADLINE_PATH, test } from "./fixtures";

// Status HTTP de verdade (sem JavaScript): o Google precisa ver 404 e 308, não "200 + noindex".
// Ver a rota única src/app/(public)/[...path]/page.tsx (ensureStatic = "navigation").

test.describe("status HTTP", () => {
  for (const path of ["/editoria-que-nao-existe", "/cidade/materia-que-nao-existe", "/a/b/c/d"]) {
    test(`404 em ${path}`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
    });
  }

  test("404 mostra a página de não encontrado", async ({ page }) => {
    const response = await page.goto("/editoria-que-nao-existe");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Ops! Essa notícia sumiu do mapa" }),
    ).toBeVisible();
    // Mascote (SVG com nome acessível) e caminho de volta.
    await expect(page.getByRole("img", { name: /Microfone do Zona Sul Urgente/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar para a página inicial" })).toBeVisible();
  });

  test("matéria na editoria errada redireciona com 308 para a URL certa", async ({ request }) => {
    const response = await request.get("/esportes/temporal-alaga-ruas-de-copacabana-e-botafogo", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    const locations = response
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "location")
      .map((h) => new URL(h.value, "http://x").pathname);
    expect(locations.length).toBeGreaterThan(0);
    for (const location of locations) expect(location).toBe(HEADLINE_PATH);
  });

  // BUG: no PRIMEIRO acesso a um endereço que redireciona (renderização sob demanda, sem cache),
  // o 308 sai com DOIS cabeçalhos `location` iguais; do segundo acesso em diante, só um.
  // Reproduzir: `next build && next start -p 3100` e, logo depois,
  //   curl -sI localhost:3100/esportes/temporal-alaga-ruas-de-copacabana-e-botafogo  (2× location)
  //   curl -sI localhost:3100/esportes/temporal-alaga-ruas-de-copacabana-e-botafogo  (1× location)
  // Origem: permanentRedirect() em src/app/(public)/[...path]/page.tsx (SectionPage), com
  // ensureStatic = "navigation" (provável bug do Next 16.4.1). Navegadores aceitam valores
  // iguais, mas o cabeçalho repetido é inválido (RFC 9110) e robôs podem estranhar.
  // fixme (e não fail): só falha no 1º acesso após o start, e o servidor pode ser reaproveitado.
  test.fixme("308 tem um único cabeçalho location (inclusive no 1º acesso)", async ({
    request,
  }) => {
    const response = await request.get("/transito/temporal-alaga-ruas-de-copacabana-e-botafogo", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    expect(response.headersArray().filter((h) => h.name.toLowerCase() === "location")).toHaveLength(
      1,
    );
  });

  test("matéria, editoria e subeditoria respondem 200", async ({ request }) => {
    for (const path of ["/", HEADLINE_PATH, "/cidade", "/busca?q=chuva"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
    }
  });
});

test.describe("indexação fora de produção", () => {
  test("robots.txt bloqueia tudo", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/User-Agent: \*/i);
    expect(body).toMatch(/^Disallow: \/$/m);
  });

  for (const path of ["/", HEADLINE_PATH, "/cidade"]) {
    test(`meta robots noindex em ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex.*nofollow/,
      );
    });
  }

  test("busca e painel também são noindex", async ({ page }) => {
    for (const path of ["/busca?q=chuva", "/admin/login"]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]').first(), path).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
  });
});
