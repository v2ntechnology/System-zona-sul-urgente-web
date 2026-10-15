import Link from "next/link";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  /**
   * "masthead": sobre a barra azul (bloco "ZONA SUL" em azul-escuro para não sumir).
   * "light": sobre fundo branco, cores exatas do logo.
   * "badge": versão redonda do Instagram (azul-claro com anel azul), para ícones.
   */
  variant?: "masthead" | "light" | "badge";
  /** Sem link: para uso dentro de outro link ou em imagens geradas. */
  asLink?: boolean;
};

// Logotipo em HTML/CSS seguindo o logo oficial do Instagram: dois blocos alinhados à
// esquerda, "ZONA SUL" (azul, mais curto) sobre "URGENTE" (vermelho, maior), em
// Montserrat ExtraBold. O tamanho escala pelo font-size do className (ex.: text-sm).
// O microfone ilustrado do logo fica de fora: trocar pelo SVG oficial quando existir.
export function BrandLogo({ className, variant = "masthead", asLink = true }: BrandLogoProps) {
  const wordmark = (
    <span className="inline-flex flex-col items-start font-logo leading-none font-extrabold uppercase">
      <span
        className={cn(
          "px-[0.45em] pt-[0.3em] pb-[0.2em] text-[1.25em] text-white",
          variant === "masthead" ? "bg-brand-blue-dark" : "bg-brand-blue",
        )}
      >
        Zona Sul
      </span>
      <span className="bg-brand-red px-[0.4em] pt-[0.25em] pb-[0.15em] text-[1.6em] text-white">
        Urgente
      </span>
    </span>
  );

  const content =
    variant === "badge" ? (
      <span className="inline-flex aspect-square items-center justify-center rounded-full border-[0.35em] border-brand-blue bg-brand-sky p-[0.9em]">
        {wordmark}
      </span>
    ) : (
      wordmark
    );

  if (!asLink) {
    return (
      <span role="img" aria-label={siteConfig.name} className={cn("inline-flex", className)}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} — página inicial`}
      className={cn("inline-flex select-none", className)}
    >
      {content}
    </Link>
  );
}
