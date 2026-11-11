import { expect, test } from "./fixtures";

// Aviso de cookies (LGPD): aparece até a pessoa escolher; a escolha fica no cookie zsu_consent.
test.describe("aviso de cookies", () => {
  test.use({ consent: false });

  for (const [button, value] of [
    ["Recusar", "1.essential"],
    ["Aceitar", "1.all"],
  ] as const) {
    test(`aparece para visitante novo e some ao clicar em "${button}"`, async ({
      page,
      context,
    }) => {
      await page.goto("/");
      const banner = page.getByRole("region", { name: "Aviso de cookies" });
      await expect(banner).toBeVisible();
      await banner.getByRole("button", { name: button, exact: true }).click();
      await expect(banner).toBeHidden();

      const cookie = (await context.cookies()).find((c) => c.name === "zsu_consent");
      expect(cookie?.value).toBe(value);

      // A escolha vale para as próximas páginas.
      await page.goto("/cidade");
      await expect(page.getByRole("heading", { level: 1, name: "Cidade" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Aviso de cookies" })).toHaveCount(0);
    });
  }

  test("não aparece no painel", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Aviso de cookies" })).toHaveCount(0);
  });
});
