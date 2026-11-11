import { expect, expectNoHorizontalScroll, HEADLINE_PATH, test } from "./fixtures";

// Nenhuma página rola de lado no celular (bug real: textos sr-only dentro de carrossel
// esticavam a página). 360 px = celular Android pequeno, a menor largura que atendemos.
test.use({ viewport: { width: 360, height: 740 } });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "celular", "só no projeto de celular");
});

const pages = [
  ["home", "/"],
  ["matéria", HEADLINE_PATH],
  ["editoria", "/cidade"],
  ["subeditoria", "/entretenimento/gastronomia"],
  ["busca", "/busca?q=chuva"],
  ["painel: login", "/admin/login"],
  ["painel: dashboard", "/admin"],
  ["painel: notícias", "/admin/noticias"],
  ["painel: Instagram", "/admin/instagram"],
  ["painel: Instagram (fila)", "/admin/instagram?visao=fila"],
  ["painel: analytics", "/admin/analytics"],
] as const;

for (const [name, path] of pages) {
  test(`sem rolagem lateral a 360 px: ${name}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
  });
}

test("sem rolagem lateral a 360 px: editor de notícia", async ({ page }) => {
  await page.goto("/admin/noticias");
  await page.locator('a[href^="/admin/noticias/"]:not([href$="/nova"])').first().click();
  await expect(page.getByPlaceholder("Título da notícia")).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("sem rolagem lateral a 360 px: menu ☰ aberto", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
