import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { sectionStyle } from "@/lib/section-color";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
  onDark?: boolean;
  /** Pinta o título com a cor da editoria; sem ela, vermelho da marca. */
  category?: { slug: string; parent?: { slug: string } };
  className?: string;
};

// Título de seção no estilo CNN ("Economia■"): cor da editoria + quadradinho, e "Ver tudo".
export function SectionHeader({
  id,
  title,
  href,
  linkLabel = "Ver tudo",
  onDark,
  category,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <h2
        id={id}
        style={sectionStyle(category)}
        className={cn("text-headline", onDark ? "text-white" : "text-[color:var(--section)]")}
      >
        {title}
        <span
          aria-hidden
          className="ml-1 inline-block size-[0.26em] bg-[color:var(--section)] align-baseline"
        />
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
