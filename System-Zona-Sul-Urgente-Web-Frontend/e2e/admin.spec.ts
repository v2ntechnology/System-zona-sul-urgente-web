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

  // Spec 001: conta ligada (dados de exemplo). A usuária da demonstração é Administradora; a
  // regra "só Administrador liga/troca/desliga" é garantida pela API (InstagramConnectionApiTests).
  test("mostra a conta ligada sem expor o acesso e sincroniza (simulado)", async ({ page }) => {
    await page.goto("/admin/instagram");
    const panel = page.getByRole("region", { name: "Conta do Instagram" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("@zonasulurgente")).toBeVisible();
    await expect(panel.getByText(/não vence/)).toBeVisible();
    await expect(
      page.getByText("Cada post vira uma notícia em rascunho", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("renova sozinho")).toHaveCount(0);
    await expect(page.getByText("publicam sozinhas")).toHaveCount(0);

    await panel.getByRole("button", { name: "Sincronizar agora" }).click();
    await expect(panel.getByText(/Demonstração: sem a API/)).toBeVisible();

    await panel.getByRole("button", { name: "Trocar conta ou acesso" }).click();
    const form = page.getByRole("form", { name: "Ligar conta do Instagram" });
    await expect(form.getByLabel("Acesso (token)")).toHaveAttribute("type", "password");
    await expect(form.getByLabel("Acesso (token)")).toHaveValue("");
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

// Spec 003: destaques da home (modo demonstração: a usuária é Administradora; a API garante as
// permissões e as regras — HomeFeaturedApiTests).
test.describe("destaques da home", () => {
  test("mostra o topo, reordena e salva (simulado)", async ({ page }) => {
    await page.goto("/admin/destaques");
    await expect(page.getByRole("heading", { level: 1, name: "Destaques da home" })).toBeVisible();

    const headline = page.getByRole("listitem", { name: /Posição 1 \(Manchete\)/ });
    const second = page.getByRole("listitem", { name: /Posição 2 / });
    const headlineTitle = (await headline.locator("span.truncate").textContent())!.trim();
    const secondTitle = (await second.locator("span.truncate").textContent())!.trim();
    await expect(page.getByRole("button", { name: "Salvar destaques" })).toBeDisabled();

    await second.getByRole("button", { name: `Subir “${secondTitle}”` }).click();
    await expect(headline.locator("span.truncate")).toHaveText(secondTitle);
    await expect(second.locator("span.truncate")).toHaveText(headlineTitle);

    await page.getByRole("button", { name: "Salvar destaques" }).click();
    await expect(page.getByText(/Demonstração: sem a API/)).toBeVisible();
  });

  test("atalho na listagem: colocar como manchete (simulado)", async ({ page }) => {
    await page.goto("/admin/noticias?status=PUBLISHED");
    await page
      .getByRole("button", { name: /^Ações para / })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Colocar como manchete" }).click();
    await expect(page.getByText(/colocar como manchete \(simulação/)).toBeVisible();
  });
});

// Spec 004: uso dos planos gratuitos (modo demonstração: números de exemplo, com as gravações de
// fotos em 74% para a faixa amarela aparecer). Só o Administrador vê a tela e a faixa; a regra por
// perfil é da API (UsageApiTests) e o menu por perfil está em src/lib/usage.test.ts.
test.describe("uso dos planos", () => {
  test("mostra as barras de cada recurso e atualiza (simulado)", async ({ page }) => {
    await page.goto("/admin/uso");
    await expect(page.getByRole("heading", { level: 1, name: "Uso dos planos" })).toBeVisible();

    const fotos = page.getByRole("article", { name: "Fotos — espaço" });
    await expect(fotos.getByText("1,2 GB de 10 GB")).toBeVisible();
    await expect(fotos.getByText("Cloudflare")).toBeVisible();
    await expect(fotos.getByText(/lido às \d{2}:\d{2}/)).toBeVisible();
    await expect(fotos.getByRole("progressbar", { name: "Fotos — espaço" })).toHaveAttribute(
      "aria-valuenow",
      "12",
    );

    const gravacoes = page.getByRole("article", { name: "Fotos — gravações" });
    await expect(gravacoes.getByText("742.318 de 1.000.000 operações")).toBeVisible();
    await expect(gravacoes.getByText("Atenção")).toBeVisible();
    await expect(gravacoes.getByText(/zera em/)).toBeVisible();

    const ia = page.getByRole("article", { name: "IA — pedidos no dia" });
    await expect(ia.getByText("conta do sistema")).toBeVisible();
    await expect(ia.getByText("zera às 04:00")).toBeVisible();

    await page.getByRole("button", { name: "Atualizar agora" }).click();
    await expect(page.getByText(/Demonstração: sem a API/)).toBeVisible();
  });

  test("faixa de alerta no painel leva à tela de uso", async ({ page }) => {
    await page.goto("/admin");
    const banner = page.getByRole("region", { name: "Aviso de uso dos planos" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Fotos — gravações em 74,2%");
    await banner.getByRole("link", { name: "Ver o uso dos planos" }).click();
    await expect(page).toHaveURL("/admin/uso");
  });

  // Desktop: no menu da conta (a navbar em pílula não comporta mais itens); celular: em "Mais".
  test("item Uso dos planos no menu do Administrador", async ({ page, isMobile }) => {
    await page.goto("/admin");
    if (isMobile) {
      await page.getByRole("button", { name: "Mais" }).click();
      await page.getByRole("link", { name: "Uso dos planos" }).click();
    } else {
      await page.getByRole("button", { name: "Conta de Juliana Prado" }).click();
      await page.getByRole("menuitem", { name: "Uso dos planos" }).click();
    }
    await expect(page).toHaveURL("/admin/uso");
  });

  test("fila do Instagram mostra os posts aguardando a cota", async ({ page }) => {
    await page.goto("/admin/instagram?visao=fila");
    await expect(page.getByText("Aguardando a IA · volta às 04:00").first()).toBeVisible();
    await expect(page.getByText("Aguardando espaço").first()).toBeVisible();
  });
});
