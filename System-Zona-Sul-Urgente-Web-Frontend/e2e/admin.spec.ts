import { expect, test } from "./fixtures";

// Painel em modo demonstração (ADMIN_PREVIEW=true, sem API): login e ações são simulados,
// a usuária de exemplo é ADMIN (currentUserMock) e vê o painel inteiro.

const SIMULATED = "(simulação — sem backend conectado)";

test("login simulado entra no painel", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("juliana@zonasulurgente.com.br");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar" }).click();

  const code = page.getByLabel("Código");
  await expect(code).toBeVisible();
  await code.fill("123456");
  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading", { level: 1, name: /^Olá, / })).toBeVisible();
});

test("login recusa senha curta", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("juliana@zonasulurgente.com.br");
  await page.getByLabel("Senha", { exact: true }).fill("curta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("A senha tem pelo menos 8 caracteres.")).toBeVisible();
  await expect(page).toHaveURL("/admin/login");
});

test("dashboard mostra a saudação e a navegação do painel", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Olá, Juliana" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Notícias/ }).first()).toBeVisible();
});

test.describe("notícias", () => {
  test("lista e abre o editor de uma notícia", async ({ page }) => {
    await page.goto("/admin/noticias");
    await expect(page.getByRole("heading", { level: 1, name: "Notícias" })).toBeVisible();
    const first = page.locator('a[href^="/admin/noticias/"]:not([href$="/nova"])').first();
    const title = (await first.textContent())!.trim();
    await first.click();

    await expect(page).toHaveURL(/\/admin\/noticias\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Editar notícia" })).toBeVisible();
    await expect(page.getByPlaceholder("Título da notícia")).toHaveValue(title);
  });

  test("escreve e pré-visualiza uma notícia nova", async ({ page }) => {
    await page.goto("/admin/noticias/nova");
    await expect(page.getByRole("heading", { level: 1, name: "Nova notícia" })).toBeVisible();
    const title = "Teste de ponta a ponta: feira na Praça General Osório";
    await page.getByPlaceholder("Título da notícia").fill(title);

    // Prazo curto: com o bug acima, falha rápido em vez de esperar o tempo do teste.
    await page.getByRole("button", { name: "Pré-visualizar" }).click({ timeout: 5_000 });
    const preview = page.getByRole("article", { name: "Pré-visualização" });
    await expect(preview.getByRole("heading", { level: 2, name: title })).toBeVisible();
    await page.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByPlaceholder("Título da notícia")).toHaveValue(title);
  });

  test("salva o rascunho de uma notícia existente (simulado)", async ({ page }) => {
    await page.goto("/admin/noticias");
    await page.locator('a[href^="/admin/noticias/"]:not([href$="/nova"])').first().click();
    const titleField = page.getByPlaceholder("Título da notícia");
    await expect(titleField).toBeVisible();
    await titleField.fill("Título alterado pelo teste de ponta a ponta");

    // Desktop: botão no cabeçalho; celular: no fim do formulário.
    await page
      .getByRole("button", { name: "Salvar rascunho" })
      .locator("visible=true")
      .first()
      .click();
    await expect(page.getByText(`Rascunho salvo às`)).toContainText(SIMULATED);
  });
});

test.describe("fila do Instagram", () => {
  test("adiciona um post colado à mão e gera o rascunho (simulado)", async ({ page }) => {
    await page.goto("/admin/instagram?visao=fila");
    await page.getByRole("button", { name: "Adicionar post" }).click();

    const form = page.getByRole("form", { name: "Adicionar post do Instagram" });
    const caption = "Moradores do Leme fazem mutirão de limpeza na praia neste domingo #leme";
    await form.getByLabel("Link do post").fill("https://www.instagram.com/p/teste-e2e/");
    await form.getByLabel("Legenda").fill(caption);
    await form.getByRole("button", { name: "Adicionar à fila" }).click();

    await expect(form).toBeHidden();
    await expect(page.getByText("Post adicionado à fila.")).toBeVisible();
    const card = page.getByRole("article").filter({ hasText: caption });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Gerar agora" }).click();
    await expect(page.getByText(SIMULATED)).toBeVisible();
  });

  test("cancelar fecha o formulário sem adicionar", async ({ page }) => {
    await page.goto("/admin/instagram");
    await page.getByRole("button", { name: "Adicionar post" }).click();
    const form = page.getByRole("form", { name: "Adicionar post do Instagram" });
    await expect(form).toBeVisible();
    await form.getByRole("button", { name: "Cancelar" }).click();
    await expect(form).toBeHidden();
    await expect(page.getByRole("button", { name: "Adicionar post" })).toBeVisible();
  });
});
