import { describe, expect, it } from "vitest";

import { matchTags, newTagError, tagKey } from "@/lib/editor/tags";
import { emptyDraft, validateDraft } from "@/lib/editor/validate";

const options = [
  { slug: "tiroteio", name: "Tiroteio" },
  { slug: "policia-militar", name: "Polícia Militar" },
  { slug: "onibus", name: "Ônibus" },
];

describe("tópicos do editor", () => {
  it("compara sem acento, caixa ou plural simples", () => {
    expect(tagKey("Tiroteios")).toBe(tagKey("tiroteio"));
    expect(tagKey("ÔNIBUS")).toBe(tagKey("onibus"));
    expect(tagKey("Polícias Militares")).toBe("policia-militare");
  });

  it("acha o existente antes de oferecer criar outro", () => {
    const { existing, matches } = matchTags("tiroteios", options);
    expect(existing?.slug).toBe("tiroteio");
    expect(matches.map((t) => t.slug)).toEqual(["tiroteio"]);
  });

  it("sugere parecidos e ignora os já escolhidos", () => {
    expect(matchTags("pol", options).matches.map((t) => t.slug)).toEqual(["policia-militar"]);
    expect(matchTags("pol", options, ["policia-militar"]).matches).toEqual([]);
    expect(matchTags("praia", options).existing).toBeUndefined();
  });

  it("valida o nome do tópico novo", () => {
    expect(newTagError("a")).toMatch(/pelo menos/);
    expect(newTagError("x".repeat(41))).toMatch(/no máximo/);
    expect(newTagError("!!")).toMatch(/letras ou números/);
    expect(newTagError("Feira de Botafogo")).toBeNull();
  });

  it("limita a 10 tópicos por matéria, contando os novos", () => {
    const draft = {
      ...emptyDraft(),
      title: "Título qualquer",
      tagSlugs: Array.from({ length: 9 }, (_, i) => `t${i}`),
      newTags: ["Novo A", "Novo B"],
    };
    expect(validateDraft(draft, "draft").newTags).toMatch(/No máximo 10/);
    expect(validateDraft({ ...draft, newTags: ["Novo A"] }, "draft").newTags).toBeUndefined();
  });
});
