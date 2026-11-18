import { unstable_rethrow } from "next/navigation";

import { usageReportMock } from "@/mocks/admin";
import { adminFetch, adminGet } from "@/services/admin/admin-api";
import { apiBaseUrl } from "@/services/api/client";
import type { UsageAlert, UsageReport, UsageResource } from "@/types/admin";

// Uso dos planos gratuitos (spec 004), só Administrador (settings.manage). Com API_URL:
// GET /api/v1/admin/usage e /usage/alerts; "Atualizar agora" fica em app/admin/(painel)/uso/actions.ts.
// Sem API: números de exemplo (src/mocks/admin.ts). Nunca em cache: cada leitura é a mais nova.

/** null = a API respondeu 404 (o monitor não existe nesta instalação). */
export async function getUsage(): Promise<UsageReport | null> {
  if (apiBaseUrl()) return adminGet<UsageReport>("/usage");
  return usageReportMock;
}

/**
 * Avisos para a faixa do painel. Qualquer falha (API fora, perfil sem permissão) vira lista vazia:
 * a faixa é um extra e nunca pode derrubar o painel.
 */
export async function getUsageAlerts(): Promise<UsageAlert[]> {
  if (!apiBaseUrl()) return alertsFrom(usageReportMock.resources);
  try {
    const result = await adminFetch<UsageAlert[]>("/usage/alerts", { timeoutMs: 3_000 });
    return result.ok && Array.isArray(result.data) ? result.data : [];
  } catch (error) {
    // redirect() do 401 (sessão vencida) e os sinais internos do Next precisam subir; o resto
    // vira "sem faixa".
    unstable_rethrow(error);
    return [];
  }
}

/** Mesma regra da API: só o que está em aviso, crítico ou travado. */
export function alertsFrom(resources: UsageResource[]): UsageAlert[] {
  return resources
    .filter((r) => r.level !== "NORMAL" || r.locked)
    .map(({ key, label, percent, level, locked }) => ({ key, label, percent, level, locked }));
}
