import { cn } from "@/lib/utils";

type BadgeProps = { className?: string; children?: React.ReactNode };

// Chapéu da matéria (editoria ou assunto), acima do título — padrão O Globo/CNN.
// Usa a cor da editoria (--section, ver sectionStyle); sem ela, o vermelho do chapéu.
export function Kicker({ className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "text-label font-bold text-[color:var(--section,var(--kicker))] uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Selo de notícia urgente. Bloco vermelho com texto branco (4,88:1).
export function UrgentBadge({ className, children = "Urgente" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 bg-urgent px-2 py-0.5 text-label font-bold text-urgent-foreground uppercase",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-current" />
      {children}
    </span>
  );
}

// Identificação pública obrigatória de conteúdo pago (ARCHITECTURE §13).
export function SponsoredBadge({ className, children = "Patrocinado" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center bg-sponsored px-2 py-0.5 text-label font-bold text-sponsored-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}
