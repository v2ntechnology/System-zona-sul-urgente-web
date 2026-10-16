import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/types/admin";

// Status de campanha (FE-157). Texto sempre presente: a cor nunca é a única pista.
const styles: Record<CampaignStatus, { label: string; className: string }> = {
  ACTIVE: { label: "No ar", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  SCHEDULED: {
    label: "Agendada",
    className: "bg-brand-sky-light text-brand-blue ring-brand-sky/40",
  },
  PAUSED: { label: "Pausada", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  DRAFT: { label: "Rascunho", className: "bg-muted text-muted-foreground ring-border" },
  ENDED: { label: "Encerrada", className: "bg-slate-100 text-slate-700 ring-slate-300" },
};

export const campaignStatusLabel = (status: CampaignStatus) => styles[status].label;

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: CampaignStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        styles[status].className,
        className,
      )}
    >
      {status === "ACTIVE" && <span aria-hidden className="size-1.5 rounded-full bg-emerald-600" />}
      {styles[status].label}
    </span>
  );
}
