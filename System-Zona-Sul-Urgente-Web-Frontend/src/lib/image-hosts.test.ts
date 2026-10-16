import { describe, expect, it } from "vitest";

import { isOptimizedImage } from "./image-hosts";

describe("isOptimizedImage", () => {
  it("otimiza caminhos locais e hosts configurados", () => {
    expect(isOptimizedImage("/brand/logo-512.png")).toBe(true);
    expect(isOptimizedImage("https://picsum.photos/seed/a/800/450")).toBe(true);
  });

  it("não otimiza outros endereços (seriam recusados pelo next/image)", () => {
    expect(isOptimizedImage("https://unsplash.com/pt-br/fotografias/x")).toBe(false);
    expect(isOptimizedImage("https://picsum.photos.evil.com/a.jpg")).toBe(false);
    expect(isOptimizedImage("//picsum.photos/a.jpg")).toBe(false);
    expect(isOptimizedImage("http://picsum.photos/a.jpg")).toBe(false);
  });
});
