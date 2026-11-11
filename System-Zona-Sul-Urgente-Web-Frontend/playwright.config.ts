import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta (QA-002). Sobem um build de produção próprio na porta 3100 (o
// `next dev` da 3000 continua livre), SEM API_URL: o site usa os dados de exemplo (data fixa
// MOCK_NOW, resultados determinísticos) e o painel abre em modo demonstração (ADMIN_PREVIEW).
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Rolagem lateral (mobile-layout) só faz sentido no celular.
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile-layout/ },
    // Pixel 7 = Chromium emulando celular (412 px); os testes de rolagem lateral usam 360 px.
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Build de produção: o comportamento real (404/308 por HTTP, robots, painel lido no build).
    // E2E_SKIP_BUILD=1 reaproveita um build feito antes (ex.: no CI, logo após `npm run build`
    // com as mesmas variáveis).
    command: process.env.E2E_SKIP_BUILD
      ? `npx next start -p ${PORT}`
      : `npx next build && npx next start -p ${PORT}`,
    url: `${baseURL}/robots.txt`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    // Variáveis do processo vencem o .env.local (que aponta para a porta 3000 e pode ter API_URL).
    env: {
      API_URL: "",
      ADMIN_PREVIEW: "true",
      MOCK_NOW: "",
      NEXT_PUBLIC_SITE_ENV: "",
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
