import { describe, expect, it } from "vitest";

import { adminAccountNav, adminNav } from "@/config/admin-navigation";
import { can } from "@/config/permissions";
import {
  alertMessage,
  bannerLevel,
  barPercent,
  displayLevel,
  formatResetsAt,
  formatUsageAmount,
  formatUsedOfLimit,
} from "@/lib/usage";
import type { Role, UsageAlert } from "@/types/admin";

describe("valores do uso dos planos", () => {
  it("bytes em GB/MB; operações e pedidos com milhar", () => {
    expect(formatUsedOfLimit(1_288_490_188, 10 * 1024 ** 3, "BYTES")).toBe("1,2 GB de 10 GB");
    expect(formatUsedOfLimit(742_318, 1_000_000, "OPERATIONS")).toBe(
      "742.318 de 1.000.000 operações",
    );
    expect(formatUsageAmount(1500, "REQUESTS")).toBe("1.500 pedidos");
  });

  it("sem limite ou travado conta como crítico", () => {
    expect(displayLevel({ level: "NORMAL", locked: false, limit: null })).toBe("CRITICAL");
    expect(displayLevel({ level: "NORMAL", locked: false, limit: 0 })).toBe("CRITICAL");
    expect(displayLevel({ level: "WARN", locked: true, limit: 10 })).toBe("CRITICAL");
    expect(displayLevel({ level: "WARN", locked: false, limit: 10 })).toBe("WARN");
  });

  it("a barra fica entre 0 e 100", () => {
    expect(barPercent({ used: 5, limit: 10, percent: null })).toBe(50);
    expect(barPercent({ used: 12, limit: 10, percent: 120 })).toBe(100);
    expect(barPercent({ used: 1, limit: 10, percent: 12.5 })).toBe(12.5);
  });

  it("'zera às' no mesmo dia e 'zera em' para datas distantes, no horário de Brasília", () => {
    expect(formatResetsAt("2026-10-16T07:00:00Z", "2026-10-15T17:48:00Z")).toBe("zera às 04:00");
    expect(formatResetsAt("2026-11-01T00:00:00Z", "2026-10-15T17:48:00Z")).toMatch(
      /^zera em 31 de out\.?, 21:00$/,
    );
  });
});

describe("faixa de alerta", () => {
  const warn: UsageAlert = {
    key: "fotos.gravacoes",
    label: "Fotos — gravações",
    percent: 74.2,
    level: "WARN",
    locked: false,
  };

  it("texto curto com o recurso, a porcentagem e o que fazer", () => {
    expect(
      alertMessage({ ...warn, key: "fotos.espaco", label: "Fotos — espaço", percent: 91 }),
    ).toBe("Fotos — espaço em 91%: avalie apagar fotos antigas ou mudar de plano");
    expect(alertMessage({ ...warn, locked: true })).toBe(
      "Fotos — gravações travado: fotos novas estão sendo recusadas",
    );
  });

  it("amarela no aviso, vermelha no crítico ou travado, nada sem avisos", () => {
    expect(bannerLevel([])).toBeNull();
    expect(bannerLevel([warn])).toBe("WARN");
    expect(bannerLevel([warn, { ...warn, key: "x", level: "CRITICAL" }])).toBe("CRITICAL");
    expect(bannerLevel([{ ...warn, locked: true }])).toBe("CRITICAL");
  });
});

describe("menu Uso dos planos", () => {
  const visible = (role: Role) =>
    [...adminNav, ...adminAccountNav]
      .filter((i) => !i.permission || can(role, i.permission))
      .map((i) => i.label);

  it("só o Administrador vê o item", () => {
    expect(visible("ADMIN")).toContain("Uso dos planos");
    for (const role of ["EDITOR", "REPORTER", "COMERCIAL", "AUTOR"] as const) {
      expect(visible(role)).not.toContain("Uso dos planos");
    }
  });
});
