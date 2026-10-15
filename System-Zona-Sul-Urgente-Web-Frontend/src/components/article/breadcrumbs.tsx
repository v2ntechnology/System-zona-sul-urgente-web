import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import type { Crumb } from "@/lib/structured-data";

// Trilha de navegação. O último item é a página atual (sem link).
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Você está em">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page" className="line-clamp-1 max-w-[18rem]">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link href={crumb.path} className="hover:text-brand-blue hover:underline">
                    {crumb.name}
                  </Link>
                  <ChevronRightIcon aria-hidden className="size-3.5" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
