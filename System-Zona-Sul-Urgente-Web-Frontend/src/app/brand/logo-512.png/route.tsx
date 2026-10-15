import { brandBadge } from "@/lib/brand-image";

// Logo quadrado 512×512 (publisher-logo dos Web Stories, ícone do PWA).
export function GET() {
  return brandBadge(512);
}
