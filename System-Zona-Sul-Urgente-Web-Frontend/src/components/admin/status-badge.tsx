import { cn } from "@/lib/utils";
import type { NewsStatus } from "@/types/news";

// Status editorial com cor própria (FE-153). Texto sempre presente: a cor nunca é a única pista.
const styles: Record<NewsStatus | "DELETED", { label: string; className: string }> = {
  DRAFT: { label: "Rascunho", className: "bg-muted text-muted-foreground ring-border" },
  IN_REVIEW: { label: "Em revisão", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  SCHEDULED: {
    label: "Agendada",
    className: "bg-brand-sky-light text-brand-blue ring-brand-sky/40",
  },
  PUBLISHED: { label: "Publicada", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  UNPUBLISHED: { label: "Despublicada", className: "bg-slate-100 text-slate-700 ring-slate-300" },
  ARCHIVED: { label: "Arquivada", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  DELETED: { label: "Na lixeira", className: "bg-red-50 text-red-800 ring-red-200" },
};

export const statusLabel = (status: NewsStatus | "DELETED") => styles[status].label;

export function StatusBadge({
  status,
  className,
}: {
  status: NewsStatus | "DELETED";
  className?: string;
}) {
  const style = styles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
