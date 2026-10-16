import { describe, expect, it } from "vitest";

import { formatCnpj, isValidCnpj, sizeFits, validateCampaign } from "@/lib/ads/validate";
import type { CampaignDraft } from "@/types/admin";
import type { AdSize, AdSlotKey } from "@/types/news";

const sizes = {
  HOME_TOP: [
    { width: 970, height: 250 },
    { width: 728, height: 90 },
  ],
} as Record<AdSlotKey, AdSize[]>;
const today = new Date("2026-10-15T15:00:00-03:00");
const base: CampaignDraft = {
  name: "Campanha teste",
  advertiserId: "a1",
  startsAt: "2026-10-20",
  endsAt: "2026-11-20",
  slots: ["HOME_TOP"],
  categories: [],
  neighborhoods: [],
  clickUrl: "https://exemplo.com.br/oferta",
  goalImpressions: "",
  creatives: { HOME_TOP: { url: "blob:x", width: 728, height: 90, alt: "Peça" } },
};

describe("validação de campanha", () => {
  it("campanha completa passa; rascunho só exige nome e anunciante", () => {
    expect(validateCampaign(base, sizes, "submit", today)).toEqual({});
    expect(validateCampaign({ ...base, slots: [], clickUrl: "" }, sizes, "draft", today)).toEqual(
      {},
    );
  });

  it("recusa tamanho de imagem que a posição não aceita", () => {
    const wrong = {
      ...base,
      creatives: { HOME_TOP: { url: "x", width: 300, height: 250, alt: "a" } },
    };
    expect(validateCampaign(wrong, sizes, "submit", today)["creative-HOME_TOP"]).toMatch(
      /300×250.*970×250, 728×90/,
    );
    expect(sizeFits({ width: 970, height: 250 }, sizes.HOME_TOP)).toBe(true);
  });

  it("datas, link e posições", () => {
    const errors = validateCampaign(
      {
        ...base,
        startsAt: "2026-10-01",
        endsAt: "2026-09-30",
        clickUrl: "http://x.com",
        slots: [],
      },
      sizes,
      "submit",
      today,
    );
    expect(errors.startsAt).toMatch(/passado/);
    expect(errors.endsAt).toMatch(/depois/);
    expect(errors.clickUrl).toMatch(/https/);
    expect(errors.slots).toBeTruthy();
  });

  it("CNPJ: dígitos verificadores e máscara", () => {
    expect(isValidCnpj("12.345.678/0001-95")).toBe(true);
    expect(isValidCnpj("12345678000196")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(formatCnpj("12345678000195")).toBe("12.345.678/0001-95");
  });
});
