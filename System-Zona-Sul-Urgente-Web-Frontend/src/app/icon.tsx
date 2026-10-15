import { brandMonogram } from "@/lib/brand-image";

// Favicon (aba do navegador): monograma "ZS" com a faixa vermelha da marca.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return brandMonogram(64);
}
