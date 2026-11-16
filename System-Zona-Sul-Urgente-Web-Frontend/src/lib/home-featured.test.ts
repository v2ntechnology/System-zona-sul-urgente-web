import { describe, expect, it } from "vitest";

import {
  droppedBy,
  move,
  normalize,
  place,
  remove,
  sectionOf,
  shortcut,
} from "@/lib/home-featured";

const sponsored = new Set(["P"]);
const isSponsored = (id: string) => sponsored.has(id);
const top = (...ids: (string | null)[]) => normalize(ids);
const trimmed = (slots: (string | null)[]) => {
  const out = [...slots];
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
};

describe("destaques da home (spec 003)", () => {
  it("nomeia as posições como a home usa", () => {
    expect([1, 2, 3, 4, 7, 8, 10].map(sectionOf)).toEqual([
      "Manchete",
      "Destaques ao lado",
      "Destaques ao lado",
      "Faixa",
      "Faixa",
      "Reserva",
      "Reserva",
    ]);
  });

  it("tirar sobe as de baixo, mas patrocinada nunca vira manchete", () => {
    expect(trimmed(remove(top("A", "B", "C"), "A", isSponsored))).toEqual(["B", "C"]);
    expect(trimmed(remove(top("A", "B", "C"), "B", isSponsored))).toEqual(["A", "C"]);
    expect(trimmed(remove(top("A", "P", "C"), "A", isSponsored))).toEqual([null, "P", "C"]);
  });

  it("atalhos: manchete empurra, destaques vai para a 2, a 10ª sai", () => {
    expect(trimmed(shortcut(top("A", "B"), "C", "MAIN", isSponsored))).toEqual(["C", "A", "B"]);
    expect(trimmed(shortcut(top("C", "A", "B"), "D", "HIGHLIGHT", isSponsored))).toEqual([
      "C",
      "D",
      "A",
      "B",
    ]);
    expect(trimmed(shortcut(top("C", "D", "A", "B"), "A", "NONE", isSponsored))).toEqual([
      "C",
      "D",
      "B",
    ]);
    expect(trimmed(shortcut(top("C", "D", "B"), "B", "MAIN", isSponsored))).toEqual([
      "B",
      "C",
      "D",
    ]);

    const full = top("1", "2", "3", "4", "5", "6", "7", "8", "9", "10");
    const after = shortcut(full, "X", "MAIN", isSponsored);
    expect(after[0]).toBe("X");
    expect(droppedBy(full, after)).toEqual(["10"]);
  });

  it("manchete automática continua automática ao pôr nos destaques, e é ocupada sem empurrar", () => {
    expect(trimmed(shortcut(top(null, "A"), "B", "HIGHLIGHT", isSponsored))).toEqual([
      null,
      "B",
      "A",
    ]);
    expect(trimmed(shortcut(top(null, "A"), "B", "MAIN", isSponsored))).toEqual(["B", "A"]);
  });

  it("patrocinada: fora da manchete, inclusive ao reordenar", () => {
    expect(() => shortcut(top("A"), "P", "MAIN", isSponsored)).toThrow(/patrocinada/);
    expect(trimmed(shortcut(top("A"), "P", "HIGHLIGHT", isSponsored))).toEqual(["A", "P"]);
    expect(trimmed(move(top("A", "P"), 2, -1, isSponsored))).toEqual(["A", "P"]);
    expect(trimmed(move(top("A", "B"), 2, -1, isSponsored))).toEqual(["B", "A"]);
  });

  it("colocar numa posição desloca as de baixo", () => {
    expect(trimmed(place(top("A", "B", "C"), "D", 3, isSponsored))).toEqual(["A", "B", "D", "C"]);
  });
});
