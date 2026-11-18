import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UsageOverview } from "@/components/admin/usage-overview";
import { can } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";
import { getUsage } from "@/services/admin/usage-service";

export const metadata: Metadata = { title: "Uso dos planos" };

// Uso dos planos gratuitos (spec 004): só o Administrador vê quanto já foi gasto das fotos, da IA e
// do disco. Para os outros perfis o endereço responde "não encontrado"; a API confere de novo.
export default async function UsagePage() {
  const user = await getCurrentUser();
  if (!can(user.role, "settings.manage")) notFound();
  const report = await getUsage();
  if (!report) notFound();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold">Uso dos planos</h1>
        <p className="text-sm text-muted-foreground">
          Quanto já foi usado da parte gratuita de cada serviço. Amarelo a partir de {report.warnAt}
          %, vermelho a partir de {report.criticalAt}%. Perto do limite o sistema trava sozinho:
          recusa fotos novas ou deixa a IA esperar, para nunca gerar cobrança.
        </p>
      </div>
      <UsageOverview initial={report} />
    </div>
  );
}
