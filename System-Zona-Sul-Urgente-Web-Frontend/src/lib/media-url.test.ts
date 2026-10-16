import { describe, expect, it } from "vitest";

import { mediaVariantUrl, parseOwnMedia, shareImage } from "./media-url";

const folder = "https://media.exemplo.com.br/media/2026/10/0b6f1c3e-8d2a-4f7e-9c1a-2b3c4d5e6f70";

describe("fotos enviadas pelo painel", () => {
  it("reconhece só o padrão gerado pela API", () => {
    expect(parseOwnMedia(`${folder}/1200.webp`)).toEqual({ folder, maxWidth: 1200 });
    expect(parseOwnMedia("https://picsum.photos/seed/a/1200/675")).toBeNull();
    expect(parseOwnMedia(`${folder}/og.jpg`)).toBeNull();
  });

  it("escolhe a menor versão que cobre a largura, sem passar da foto", () => {
    expect(mediaVariantUrl(`${folder}/1200.webp`, 384)).toBe(`${folder}/400.webp`);
    expect(mediaVariantUrl(`${folder}/1200.webp`, 640)).toBe(`${folder}/800.webp`);
    expect(mediaVariantUrl(`${folder}/1200.webp`, 3840)).toBe(`${folder}/1200.webp`);
    // Foto de 900 px: existem 400, 800 e 900 (não há 1200).
    expect(mediaVariantUrl(`${folder}/900.webp`, 1080)).toBe(`${folder}/900.webp`);
    expect(mediaVariantUrl(`${folder}/900.webp`, 750)).toBe(`${folder}/800.webp`);
    expect(mediaVariantUrl("https://picsum.photos/a.jpg", 400)).toBe("https://picsum.photos/a.jpg");
  });

  it("compartilha o og.jpg 1200×630", () => {
    const image = { url: `${folder}/900.webp`, width: 900, height: 1600, alt: "x" };
    expect(shareImage(image)).toEqual({
      url: `${folder}/og.jpg`,
      width: 1200,
      height: 630,
      alt: "x",
    });
    const external = { url: "https://picsum.photos/a.jpg", width: 1200, height: 675 };
    expect(shareImage(external)).toBe(external);
  });
});
