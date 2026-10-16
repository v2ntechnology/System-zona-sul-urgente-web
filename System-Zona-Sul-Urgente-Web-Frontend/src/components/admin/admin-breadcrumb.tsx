"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { adminPathCrumbs, adminSegmentLabels } from "@/config/admin-navigation";

// Trilha do painel (Painel › Notícias › Editar). Some na página inicial do painel.
export function AdminBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const crumbs = segments.map((segment, i) => {
    const href = `/${segments.slice(0, i + 1).join("/")}`;
    const override = adminPathCrumbs[href];
    return {
      label:
        override?.label ??
        adminSegmentLabels[segment] ??
        (segments[i - 1] === "campanhas" ? "Campanha" : "Editar"),
      href: override?.href ?? href,
    };
  });
  return (
    <nav aria-label="Você está em">
      <ol className="flex h-5 items-center gap-1 truncate text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <li key={`${i}-${crumb.href}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon aria-hidden className="size-3.5" />}
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="font-semibold text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground hover:underline">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
