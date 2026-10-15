import { describe, expect, it } from "vitest";

import { sanitizeInlineHtml } from "@/lib/sanitize";

describe("sanitizeInlineHtml", () => {
  it("mantém negrito, itálico e links seguros", () => {
    expect(sanitizeInlineHtml("Texto <strong>forte</strong> e <em>itálico</em>")).toBe(
      "Texto <strong>forte</strong> e <em>itálico</em>",
    );
    expect(sanitizeInlineHtml('<a href="/seguranca">editoria</a>')).toBe(
      '<a href="/seguranca">editoria</a>',
    );
  });

  it("remove scripts, eventos e protocolos perigosos", () => {
    const dirty =
      '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><p onclick="x()">p</p>';
    const clean = sanitizeInlineHtml(dirty);
    expect(clean).not.toMatch(/script|onerror|onclick|javascript:|<img|<p/i);
  });

  it("links externos abrem em nova aba com nofollow", () => {
    const html = sanitizeInlineHtml('<a href="https://exemplo.com/x" target="_self">fonte</a>');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("converte <b> e <i> para as tags semânticas", () => {
    expect(sanitizeInlineHtml("<b>a</b> <i>b</i>")).toBe("<strong>a</strong> <em>b</em>");
  });
});

describe("sanitizeInlineHtml — atributos vindos do texto", () => {
  it("descarta target/rel escritos no HTML de origem em links internos", () => {
    expect(sanitizeInlineHtml('<a href="/x" target="_top" rel="opener">x</a>')).toBe(
      '<a href="/x">x</a>',
    );
  });
});
