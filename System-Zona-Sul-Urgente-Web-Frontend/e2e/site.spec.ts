import { expect, HEADLINE, HEADLINE_PATH, test } from "./fixtures";

// Portal com os dados de exemplo (sem API_URL, data fixa MOCK_NOW).

test("home carrega com a manchete", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Zona Sul Urgente/);
  await expect(page.getByRole("heading", { level: 2, name: HEADLINE })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Editorias" }).first()).toBeAttached();
});

test("abre a matéria pelo clique na manchete", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { level: 2, name: HEADLINE }).getByRole("link").click();
  await expect(page).toHaveURL(HEADLINE_PATH);
  await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
  await expect(page.getByText("Defesa Civil do Rio").first()).toBeVisible();
});

test("editoria lista as matérias dela", async ({ page }) => {
  await page.goto("/cidade");
  await expect(page.getByRole("heading", { level: 1, name: "Cidade" })).toBeVisible();
  await expect(page.getByRole("link", { name: HEADLINE }).first()).toBeVisible();
});

test("navega até uma editoria pela barra de editorias", async ({ page }) => {
  await page.goto("/");
  // Desktop: barra azul; celular: faixa abaixo do cabeçalho. Só uma das duas aparece.
  const nav = page.getByRole("navigation", { name: "Editorias" }).locator("visible=true");
  await nav.getByRole("link", { name: "Cidade", exact: true }).first().click();
  await expect(page).toHaveURL("/cidade");
  await expect(page.getByRole("heading", { level: 1, name: "Cidade" })).toBeVisible();
});

test.describe("busca", () => {
  test("com resultado", async ({ page }) => {
    await page.goto("/busca");
    const input = page.getByRole("searchbox", { name: "Termo da busca" });
    await input.fill("temporal");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/busca\?q=temporal/);
    await expect(page.getByText(/\d+ resultados? para/)).toBeVisible();
    await expect(page.getByRole("link", { name: HEADLINE }).first()).toBeVisible();
  });

  test("sem resultado", async ({ page }) => {
    await page.goto("/busca?q=xyzzy-sem-noticia");
    await expect(page.getByText("0 resultados para")).toBeVisible();
    await expect(
      page.getByText("Nenhuma notícia encontrada para “xyzzy-sem-noticia”."),
    ).toBeVisible();
  });

  test("pela lupa do cabeçalho", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Buscar" }).first().click();
    await expect(page).toHaveURL("/busca");
    await expect(page.getByRole("searchbox", { name: "Termo da busca" })).toBeVisible();
  });
});

test("menu ☰ abre com as editorias e navega", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("heading", { name: "Bairros" })).toBeVisible();
  await menu.getByRole("link", { name: "Segurança", exact: true }).first().click();
  await expect(page).toHaveURL("/seguranca");
  await expect(menu).toBeHidden();
});
