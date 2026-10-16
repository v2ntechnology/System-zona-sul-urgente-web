/**
 * Endereços de imagem que passam pelo otimizador do Next (`images.remotePatterns`).
 * Fotos de outros endereços (coladas no editor até existir o envio de mídia, BE-012)
 * são exibidas direto, sem otimização — o otimizador recusaria e a página quebraria.
 */
export const OPTIMIZED_IMAGE_PATTERNS = ["https://picsum.photos/**"];

const prefixes = OPTIMIZED_IMAGE_PATTERNS.map((p) => p.replace(/\*\*$/, ""));

/** Caminho local (`/brand/...`) ou endereço de um host da lista acima. */
export function isOptimizedImage(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  return prefixes.some((prefix) => src.startsWith(prefix));
}
