import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
  onDark?: boolean;
  className?: string;
};

// Título de seção com barra vermelha e link "Ver tudo" opcional.
export function SectionHeader({
  id,
  title,
  href,
  linkLabel = "Ver tudo",
  onDark,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <h2 id={id} className={cn("flex items-center gap-3 text-headline", onDark && "text-white")}>
        <span aria-hidden className="h-[0.9em] w-1.5 bg-brand-red" />
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className={cn(
            "group inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline",
            onDark ? "text-white focus-visible:outline-white" : "text-brand-blue",
          )}
        >
          {linkLabel}
          <span className="sr-only">: {title}</span>
          <ArrowRightIcon
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </div>
  );
}
