import { expect, test as base, type Page } from "@playwright/test";

/** Cookie do aviso de cookies (LGPD): com ele, o aviso não cobre o rodapé nos testes. */
export const CONSENT_COOKIE = "zsu_consent";

type Options = {
  /** false = abre o site como visitante novo, com o aviso de cookies na tela. */
  consent: boolean;
};

export const test = base.extend<Options>({
  consent: [true, { option: true }],
  context: async ({ context, consent, baseURL }, use) => {
    if (consent) {
      await context.addCookies([{ name: CONSENT_COOKIE, value: "1.essential", url: baseURL! }]);
    }
    await use(context);
  },
});

export { expect };

/** Manchete da home nos dados de exemplo (src/mocks/news.ts, `featured: 1`). */
export const HEADLINE = "Temporal alaga ruas de Copacabana e Botafogo; Defesa Civil emite alerta";
export const HEADLINE_PATH = "/cidade/temporal-alaga-ruas-de-copacabana-e-botafogo";

/**
 * A página não pode rolar de lado. Carrosséis com rolagem própria (overflow-x) são válidos:
 * eles não aumentam a largura do documento. Também tenta rolar a janela para a direita.
 */
export async function expectNoHorizontalScroll(page: Page) {
  const result = await page.evaluate(() => {
    window.scrollTo(400, window.scrollY);
    const scrolled = window.scrollX;
    window.scrollTo(0, window.scrollY);
    const width = window.innerWidth;
    // Ajuda a achar o culpado quando falha: o elemento mais à direita.
    const widest = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((el) => ({ el, right: el.getBoundingClientRect().right }))
      .filter(({ el, right }) => {
        if (right <= width + 1) return false;
        // Dentro de um carrossel (ancestral com rolagem/corte próprio) não conta.
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const overflow = getComputedStyle(p).overflowX;
          if (overflow !== "visible") return false;
        }
        return true;
      })
      .slice(0, 3)
      .map(
        ({ el, right }) => `${el.tagName.toLowerCase()}.${el.className} (${Math.round(right)}px)`,
      );
    return {
      scrollWidth: document.documentElement.scrollWidth,
      width,
      scrolled,
      widest,
    };
  });
  expect(
    result.scrollWidth,
    `página mais larga que a tela (${result.width}px): ${result.widest.join(", ")}`,
  ).toBeLessThanOrEqual(result.width);
  expect(result.scrolled, "a janela rolou para o lado").toBe(0);
}
