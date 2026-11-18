import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatCount,
  formatPercent,
  formatRelative,
  formatShortDateTime,
  formatTime,
} from "@/lib/format";

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

describe("formatShortDateTime", () => {
  it("usa dd/mm/aa às hh:mm no fuso do Rio", () => {
    expect(formatShortDateTime("2026-10-15T10:46:00Z")).toBe("15/10/26 às 07:46");
  });
});

describe("números do uso dos planos", () => {
  it("formata bytes em base 1024", () => {
    expect(formatBytes(1_288_490_188)).toBe("1,2 GB");
    expect(formatBytes(10_737_418_240)).toBe("10 GB");
    expect(formatBytes(850 * 1024 * 1024)).toBe("850 MB");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(1)).toBe("1 byte");
    expect(formatBytes(0)).toBe("0 bytes");
  });

  it("usa o separador de milhar do português", () => {
    expect(formatCount(1_000_000)).toBe("1.000.000");
    expect(formatCount(1234)).toBe("1.234");
    expect(formatCount(38)).toBe("38");
  });

  it("porcentagem com no máximo uma casa", () => {
    expect(formatPercent(12)).toBe("12%");
    expect(formatPercent(91.54)).toBe("91,5%");
  });
});
