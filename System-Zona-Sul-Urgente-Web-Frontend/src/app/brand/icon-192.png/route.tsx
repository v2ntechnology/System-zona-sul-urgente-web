import { brandBadge } from "@/lib/brand-image";

// Ícone do PWA (manifest).
export function GET() {
  return brandBadge(192);
}
