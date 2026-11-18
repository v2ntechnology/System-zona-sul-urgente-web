/**
 * Foto "em pé" (mais alta que larga, com folga de 5%): capa de Reels e foto de celular. Num quadro horizontal, cortar
 * o meio dela e ampliar deixa a imagem borrada — por isso ganha moldura (ver RemoteImage `frame`).
 */
export function isPortrait(width: number, height: number): boolean {
  if (!width || !height) return false;
  return height > width * 1.05;
}
