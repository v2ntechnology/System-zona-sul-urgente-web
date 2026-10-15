"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

type CarouselRowProps = {
  /** Cabeçalho à esquerda (normalmente um <SectionHeader />). */
  header: React.ReactNode;
  /** Rótulo das setas para leitores de tela, ex.: "Mais lidas". */
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Classe de largura de cada item (ex.: "w-64"), aplicada pelos filhos. */
  trackClassName?: string;
};

// Faixa horizontal com rolagem por arrasto/trackpad e setas ← → (estilo CNN).
// Sem JavaScript continua rolável; as setas só aceleram a navegação.
export function CarouselRow({
  header,
  label,
  children,
  className,
  trackClassName,
}: CarouselRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({
      left: direction * track.clientWidth * 0.9,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const arrow =
    "inline-flex size-9 items-center justify-center rounded-full border bg-background transition hover:border-brand-blue hover:text-brand-blue";

  return (
    <section className={className}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">{header}</div>
        <div className="hidden shrink-0 gap-2 pt-1 sm:flex">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={`${label}: anteriores`}
            className={arrow}
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={`${label}: próximas`}
            className={arrow}
          >
            <ArrowRightIcon className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div
        ref={trackRef}
        className={cn(
          "-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-5 overflow-x-auto px-4 pb-2",
          trackClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
