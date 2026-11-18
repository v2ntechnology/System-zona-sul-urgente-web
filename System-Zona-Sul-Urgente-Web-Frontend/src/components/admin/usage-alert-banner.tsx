import { ArrowRightIcon, OctagonAlertIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { adminRoutes } from "@/config/admin-navigation";
import { alertMessage, bannerLevel } from "@/lib/usage";
import { cn } from "@/lib/utils";
import type { UsageAlert } from "@/types/admin";

// Faixa de alerta do uso dos planos (spec 004), no topo do painel, só para o Administrador:
// amarela a partir de 70% (WARN); vermelha a partir de 90% ou com trava ligada. Sem avisos, nada.
export function UsageAlertBanner({ alerts }: { alerts: UsageAlert[] }) {
  const level = bannerLevel(alerts);
  if (!level) return null;
  const critical = level === "CRITICAL";
  const Icon = critical ? OctagonAlertIcon : TriangleAlertIcon;
  return (
    <section
      aria-label="Aviso de uso dos planos"
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center",
        critical
          ? "border-red-300 bg-red-50 text-red-900"
          : "border-amber-300 bg-amber-50 text-amber-950",
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-5 shrink-0", critical ? "text-red-600" : "text-amber-600")}
      />
      <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
        {alerts.map((alert) => (
          <li key={alert.key} className="font-medium">
            {alertMessage(alert)}
          </li>
        ))}
      </ul>
      <Link
        href={adminRoutes.usage}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 font-semibold underline-offset-2 hover:underline",
          critical ? "text-red-800" : "text-amber-900",
        )}
      >
        Ver o uso dos planos <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
    </section>
  );
}
