import Link from "next/link";

import { siteConfig } from "@/config/site";

// Placeholder do header público. A versão final (top bar, navegação,
// busca e menu mobile) entra no FE-007, depois das referências visuais.
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {siteConfig.name}
        </Link>
      </div>
    </header>
  );
}
