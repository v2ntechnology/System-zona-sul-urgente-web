import { describe, expect, it } from "vitest";

import { formatCount, formatDuration, niceTicks, percentChange } from "@/lib/chart";

describe("chart helpers", () => {
  it("gera marcas redondas que cobrem o máximo", () => {
    expect(niceTicks(9_340)).toEqual([0, 2500, 5000, 7500, 10000]);
    expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0)).toEqual([0]);
  });

  it("formata contagens, variação e duração", () => {
    expect(formatCount(1284)).toBe("1.284");
    expect(formatCount(84_210)).toMatch(/84,2\s?mil/);
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(5, 0)).toBeNull();
    expect(formatDuration(104)).toBe("1 min 44 s");
    expect(formatDuration(45)).toBe("45 s");
  });
});
