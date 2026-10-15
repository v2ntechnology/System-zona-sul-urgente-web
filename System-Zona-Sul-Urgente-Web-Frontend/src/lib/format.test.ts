import { describe, expect, it } from "vitest";

import { formatRelative, formatTime } from "@/lib/format";

const iso = "2026-10-15T14:00:00-03:00";
const at = (minutesLater: number) => Date.parse(iso) + minutesLater * 60_000;

describe("formatRelative", () => {
  it("usa minutos e horas nas últimas 24 h", () => {
    expect(formatRelative(iso, at(0.5))).toBe("agora");
    expect(formatRelative(iso, at(12))).toBe("há 12 min");
    expect(formatRelative(iso, at(185))).toBe("há 3 h");
  });

  it("volta para data e hora acima de 24 h ou em data futura", () => {
    expect(formatRelative(iso, at(25 * 60))).toMatch(/15.*out.*14:00/);
    expect(formatRelative(iso, at(-10))).toMatch(/14:00/);
  });

  it("formata no fuso do Rio", () => {
    expect(formatTime("2026-10-15T17:00:00Z")).toBe("14:00");
  });
});
