import { cn } from "@/lib/utils";
import type { InstagramImportStatus } from "@/types/admin";

// Status da importação do Instagram (FE-155). Texto sempre presente: a cor nunca é a única pista.
const styles: Record<InstagramImportStatus, { label: string; className: string }> = {
  NEW: { label: "Novo", className: "bg-brand-sky-light text-brand-blue ring-brand-sky/40" },
  IMPORTED: {
    label: "Importado",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  CHANGED_AT_SOURCE: {
    label: "Alterado no Instagram",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  ERROR: { label: "Erro", className: "bg-red-50 text-red-800 ring-red-200" },
  IGNORED: { label: "Ignorado", className: "bg-muted text-muted-foreground ring-border" },
  REMOVED_AT_SOURCE: {
    label: "Removido do Instagram",
    className: "bg-slate-100 text-slate-700 ring-slate-300",
  },
};

export const instagramStatusLabel = (status: InstagramImportStatus) => styles[status].label;

export function InstagramStatusBadge({
  status,
  className,
}: {
  status: InstagramImportStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        styles[status].className,
        className,
      )}
    >
      {styles[status].label}
    </span>
  );
}
