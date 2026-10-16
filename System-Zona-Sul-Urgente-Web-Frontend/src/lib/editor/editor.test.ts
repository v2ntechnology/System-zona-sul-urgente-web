import { describe, expect, it } from "vitest";

import { blocksToEditorHtml, countWords, docToBlocks } from "@/lib/editor/blocks";
import { emptyDraft, validateDraft } from "@/lib/editor/validate";
import type { NewsDraft } from "@/types/admin";

describe("docToBlocks", () => {
  it("converte parágrafos com negrito, itálico e link, e descarta formatos não suportados", () => {
    const blocks = docToBlocks({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Chuva " },
            { type: "text", text: "forte", marks: [{ type: "bold" }] },
            { type: "text", text: " em ", marks: [{ type: "underline" }] },
            {
              type: "text",
              text: "Copacabana",
              marks: [{ type: "link", attrs: { href: "/bairro/copacabana" } }],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "<script>x</script>" }] },
        { type: "paragraph" },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "O que fazer" }] },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Fiquem em casa." }] }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Ligue 199" }] }],
            },
          ],
        },
      ],
    });
    expect(blocks).toEqual([
      {
        type: "paragraph",
        html: 'Chuva <strong>forte</strong> em <a href="/bairro/copacabana">Copacabana</a>',
      },
      { type: "paragraph", html: "&lt;script&gt;x&lt;/script&gt;" },
      { type: "heading", text: "O que fazer" },
      { type: "quote", text: "Fiquem em casa." },
      { type: "list", ordered: false, items: ["Ligue 199"] },
    ]);
  });

  it("descarta links com protocolo perigoso", () => {
    const blocks = docToBlocks({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });
    expect(blocks).toEqual([{ type: "paragraph", html: "x" }]);
  });

  it("gera HTML do editor a partir dos blocos e conta palavras", () => {
    const html = blocksToEditorHtml([
      { type: "heading", text: "A & B" },
      { type: "list", ordered: true, items: ["um", "dois"] },
    ]);
    expect(html).toBe("<h2>A &amp; B</h2><ol><li><p>um</p></li><li><p>dois</p></li></ol>");
    expect(countWords([{ type: "paragraph", html: "duas <strong>palavras</strong>" }])).toBe(2);
  });
});

describe("validateDraft", () => {
  const complete: NewsDraft = {
    ...emptyDraft(),
    title: "Temporal alaga ruas de Copacabana",
    summary: "Chuva forte deixou pontos de alagamento na Avenida Atlântica nesta tarde.",
    body: [{ type: "paragraph", html: "Texto." }],
    categorySlug: "cidade",
    authorSlugs: ["ana-ribeiro"],
    image: { url: "https://exemplo.com/f.jpg", alt: "Rua alagada", caption: "", credit: "" },
  };
  const now = new Date("2026-10-15T15:00:00-03:00");

  it("rascunho só exige título", () => {
    expect(
      validateDraft({ ...emptyDraft(), title: "Oi", categorySlug: "cidade" }, "draft", now),
    ).toEqual({});
    expect(
      validateDraft({ ...emptyDraft(), title: "Oi" }, "draft", now).categorySlug,
    ).toBeDefined();
    expect(validateDraft(emptyDraft(), "draft", now).title).toBeDefined();
  });

  it("publicar exige matéria completa", () => {
    expect(validateDraft(complete, "publish", now)).toEqual({});
    const errors = validateDraft(
      { ...emptyDraft(), title: "Título curto demais?" },
      "publish",
      now,
    );
    expect(Object.keys(errors).sort()).toEqual([
      "authorSlugs",
      "body",
      "categorySlug",
      "image.url",
      "summary",
    ]);
    expect(
      validateDraft({ ...complete, image: { ...complete.image, alt: "" } }, "publish", now)[
        "image.alt"
      ],
    ).toBeDefined();
  });

  it("patrocinada exige patrocinador e agendamento exige data futura", () => {
    expect(
      validateDraft({ ...complete, isSponsored: true }, "publish", now).sponsorName,
    ).toBeDefined();
    expect(
      validateDraft({ ...complete, scheduledFor: "2026-10-15T14:00" }, "schedule", now)
        .scheduledFor,
    ).toBe("A data precisa estar no futuro.");
    expect(
      validateDraft({ ...complete, scheduledFor: "2026-10-16T09:00" }, "schedule", now),
    ).toEqual({});
  });
});
