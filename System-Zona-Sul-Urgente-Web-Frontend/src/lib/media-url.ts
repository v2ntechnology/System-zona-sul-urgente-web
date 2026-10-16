/**
 * Fotos enviadas pelo painel (BE-012) ficam em `.../media/{aaaa}/{mm}/{uuid}/` com as larguras
 * 400, 800 e 1200 (as menores que a foto + a largura dela, até 1200) em WebP e AVIF, e og.jpg
 * (1200×630) para compartilhamento. O contrato traz o endereço da MAIOR versão WebP; daqui
 * saem as demais. Sem o otimizador do Next (ARCHITECTURE §18).
 */
const OWN_MEDIA = /^(.+\/media\/\d{4}\/\d{2}\/[0-9a-f-]{36})\/(\d+)\.webp$/;

const WIDTHS = [400, 800, 1200];

export function parseOwnMedia(src: string): { folder: string; maxWidth: number } | null {
  const match = OWN_MEDIA.exec(src);
  return match ? { folder: match[1], maxWidth: Number(match[2]) } : null;
}

/** Menor versão que cobre a largura pedida (nunca maior que a foto). */
export function mediaVariantUrl(src: string, width: number): string {
  const own = parseOwnMedia(src);
  if (!own) return src;
  const chosen = WIDTHS.find((w) => w >= width && w < own.maxWidth) ?? own.maxWidth;
  return `${own.folder}/${chosen}.webp`;
}

/** Imagem de compartilhamento (OpenGraph/WhatsApp): og.jpg 1200×630 das fotos enviadas. */
export function shareImage<T extends { url: string; width: number; height: number }>(image: T): T {
  const own = parseOwnMedia(image.url);
  return own ? { ...image, url: `${own.folder}/og.jpg`, width: 1200, height: 630 } : image;
}
