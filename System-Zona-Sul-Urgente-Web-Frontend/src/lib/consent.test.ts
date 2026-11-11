import { describe, expect, it } from "vitest";

import { adsAllowed, consentCookie, parseConsent } from "@/lib/consent";

describe("consentimento de cookies", () => {
  it("lê a escolha gravada entre outros cookies", () => {
    expect(parseConsent("a=1; zsu_consent=1.all; b=2")).toBe("all");
    expect(parseConsent("zsu_consent=1.essential")).toBe("essential");
  });

  it("sem cookie, com versão antiga ou valor estranho: pergunta de novo", () => {
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("zsu_consent=0.all")).toBeNull();
    expect(parseConsent("zsu_consent=1.tudo")).toBeNull();
    expect(parseConsent("xzsu_consent=1.all")).toBeNull();
  });

  it("grava por 6 meses no site todo; Secure só em https", () => {
    expect(consentCookie("all", true)).toBe(
      "zsu_consent=1.all; Max-Age=15552000; Path=/; SameSite=Lax; Secure",
    );
    expect(consentCookie("essential", false)).not.toContain("Secure");
    expect(parseConsent(consentCookie("essential", false).split(";")[0])).toBe("essential");
  });

  it("publicidade só com aceite", () => {
    expect(adsAllowed("all")).toBe(true);
    expect(adsAllowed("essential")).toBe(false);
    expect(adsAllowed(null)).toBe(false);
  });
});
