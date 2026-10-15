import { brandBadge } from "@/lib/brand-image";

// Ícone da tela inicial no iPhone (o iOS arredonda os cantos sozinho).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandBadge(180, { maskable: true });
}
