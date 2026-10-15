import Link from "next/link";

import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
  /** Destaque de atenção (ex.: erros de importação > 0). */
  tone?: "default" | "warning" | "danger";
  hint?: React.ReactNode;
};

const numberFormat = new Intl.NumberFormat("pt-BR");

// Cartão de indicador do dashboard (FE-152). Clicável quando leva a uma lista filtrada.
export function StatCard({ label, value, icon, href, tone = "default", hint }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          aria-hidden
          className={cn(
            "flex size-8 items-center justify-center rounded-md",
            tone === "danger" && "bg-red-50 text-red-700",
            tone === "warning" && "bg-amber-50 text-amber-700",
            tone === "default" && "bg-brand-sky-light text-brand-blue",
          )}
        >
          {icon}
        </span>
      </div>
      <span className="font-heading text-3xl font-bold tabular-nums">
        {numberFormat.format(value)}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </>
  );
  const className = cn(
    "flex flex-col gap-2 rounded-lg border bg-background p-4 shadow-xs",
    tone === "danger" && value > 0 && "border-red-300",
    href && "transition hover:border-brand-blue hover:shadow-sm",
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
