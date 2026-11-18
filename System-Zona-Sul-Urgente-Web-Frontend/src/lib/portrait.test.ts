import { describe, expect, it } from "vitest";

import { isPortrait } from "./portrait";

describe("isPortrait", () => {
  it("reconhece a capa de Reels (9:16)", () => {
    expect(isPortrait(1170, 2080)).toBe(true);
  });

  it("não muda fotos horizontais nem quadradas", () => {
    expect(isPortrait(1200, 675)).toBe(false);
    expect(isPortrait(1080, 1080)).toBe(false);
    expect(isPortrait(1000, 1040)).toBe(false);
  });

  it("sem dimensões, trata como horizontal", () => {
    expect(isPortrait(0, 0)).toBe(false);
  });
});
