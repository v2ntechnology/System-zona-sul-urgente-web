import { describe, expect, it } from "vitest";

import { accentInsensitivePattern } from "@/lib/highlight";

describe("accentInsensitivePattern", () => {
  it("acha o termo com ou sem acento", () => {
    const re = new RegExp(accentInsensitivePattern("reboucas"), "i");
    expect(re.test("Túnel Rebouças")).toBe(true);
    expect(new RegExp(accentInsensitivePattern("Gávea"), "i").test("gavea")).toBe(true);
  });

  it("escapa caracteres especiais de regex", () => {
    expect(() => new RegExp(accentInsensitivePattern("a+b(c"))).not.toThrow();
    expect(new RegExp(accentInsensitivePattern("a+b")).test("a+b")).toBe(true);
  });
});
