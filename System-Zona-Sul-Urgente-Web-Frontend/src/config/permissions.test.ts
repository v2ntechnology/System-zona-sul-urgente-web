import { describe, expect, it } from "vitest";

import { can } from "@/config/permissions";

// Células críticas da matriz da ARCHITECTURE §8.
describe("matriz de permissões", () => {
  it("só ADMIN e EDITOR publicam", () => {
    expect(can("ADMIN", "news.publish")).toBe(true);
    expect(can("EDITOR", "news.publish")).toBe(true);
    expect(can("REPORTER", "news.publish")).toBe(false);
    expect(can("COMERCIAL", "news.publish")).toBe(false);
    expect(can("AUTOR", "news.publish")).toBe(false);
  });

  it("publicidade é só de ADMIN e COMERCIAL", () => {
    expect(can("COMERCIAL", "ads.manage")).toBe(true);
    expect(can("EDITOR", "ads.manage")).toBe(false);
  });

  it("gestão de usuários e configurações do Instagram é só do ADMIN", () => {
    for (const role of ["EDITOR", "REPORTER", "COMERCIAL", "AUTOR"] as const) {
      expect(can(role, "users.manage")).toBe(false);
      expect(can(role, "instagram.settings")).toBe(false);
    }
  });
});
