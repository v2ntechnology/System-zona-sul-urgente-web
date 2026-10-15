import { describe, expect, it } from "vitest";

import { diffWords } from "@/lib/word-diff";

describe("diffWords", () => {
  it("marca palavras trocadas, incluídas e mantidas", () => {
    expect(diffWords("assalto no Posto 9 hoje", "assalto no Posto 8 hoje, às 6h")).toEqual([
      { type: "same", text: "assalto no Posto" },
      { type: "removed", text: "9 hoje" },
      { type: "added", text: "8 hoje, às 6h" },
    ]);
  });

  it("textos iguais ou vazios", () => {
    expect(diffWords("a b", "a  b")).toEqual([{ type: "same", text: "a b" }]);
    expect(diffWords("", "novo")).toEqual([{ type: "added", text: "novo" }]);
    expect(diffWords("velho", "")).toEqual([{ type: "removed", text: "velho" }]);
  });
});
