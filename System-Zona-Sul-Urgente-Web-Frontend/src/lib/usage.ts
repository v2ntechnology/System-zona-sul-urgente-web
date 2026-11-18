import { formatBytes, formatCount, formatDateTime, formatPercent, formatTime } from "@/lib/format";
import type { UsageAlert, UsageLevel, UsageResource, UsageUnit } from "@/types/admin";

// Regras de exibição do uso dos planos (spec 004), comuns à tela /admin/uso e à faixa do painel.

const UNIT_WORDS: Record<Exclude<UsageUnit, "BYTES">, string> = {
  OPERATIONS: "operações",
  REQUESTS: "pedidos",
};

/** "1,2 GB", "742.318 operações", "38 pedidos". */
export function formatUsageAmount(value: number, unit: UsageUnit): string {
  if (unit === "BYTES") return formatBytes(value);
  return `${formatCount(value)} ${UNIT_WORDS[unit]}`;
}

/** "1,2 GB de 10 GB", "742.318 de 1.000.000 operações". */
export function formatUsedOfLimit(used: number, limit: number, unit: UsageUnit): string {
  if (unit === "BYTES") return `${formatBytes(used)} de ${formatBytes(limit)}`;
  return `${formatCount(used)} de ${formatUsageAmount(limit, unit)}`;
}

/** Sem limite (nulo ou 0) não dá para medir a folga: a tela trata como crítico. */
export function hasLimit(resource: Pick<UsageResource, "limit">): resource is { limit: number } {
  return typeof resource.limit === "number" && resource.limit > 0;
}

/** Nível para a cor: travado ou sem limite configurado contam como crítico. */
export function displayLevel(
  resource: Pick<UsageResource, "level" | "locked" | "limit">,
): UsageLevel {
  if (resource.locked || !hasLimit(resource)) return "CRITICAL";
  return resource.level;
}

/** Porcentagem para a barra (0–100); usa a da API e, sem ela, calcula. */
export function barPercent(resource: Pick<UsageResource, "used" | "limit" | "percent">): number {
  const raw =
    resource.percent ??
    (resource.limit && resource.limit > 0 ? (resource.used / resource.limit) * 100 : 100);
  return Math.min(100, Math.max(0, raw));
}

/**
 * "zera às 15:01" quando falta menos de um dia (janela do minuto ou do dia); senão a data:
 * "zera em 31 de out., 21:00". Sempre no horário de Brasília. A referência é a hora da leitura
 * (estável entre servidor e navegador).
 */
export function formatResetsAt(resetsAt: string, reference: string | null): string {
  const ref = reference ? Date.parse(reference) : Number.NaN;
  const diff = Date.parse(resetsAt) - ref;
  if (Number.isFinite(diff) && diff >= 0 && diff < 24 * 3_600_000) {
    return `zera às ${formatTime(resetsAt)}`;
  }
  return `zera em ${formatDateTime(resetsAt)}`;
}

/** O que fazer, conforme o recurso (texto curto da faixa do painel). */
export function usageHint(key: string): string {
  if (key.startsWith("fotos.leituras")) return "acompanhe; as leituras não travam o site";
  if (key.startsWith("fotos.")) return "avalie apagar fotos antigas ou mudar de plano";
  if (key.startsWith("ia.")) return "os rascunhos da IA podem esperar a cota voltar";
  if (key.startsWith("disco")) return "libere espaço no servidor (backups e versões antigas)";
  return "veja os detalhes no uso dos planos";
}

/** "Fotos — espaço em 91,5%: avalie apagar fotos antigas ou mudar de plano". */
export function alertMessage(alert: UsageAlert): string {
  if (alert.locked) {
    const what = alert.key.startsWith("ia.")
      ? "a IA está esperando a cota voltar"
      : alert.key.startsWith("fotos.")
        ? "fotos novas estão sendo recusadas"
        : "o uso está pausado";
    return `${alert.label} travado: ${what}`;
  }
  const at =
    alert.percent === null ? "sem limite configurado" : `em ${formatPercent(alert.percent)}`;
  return `${alert.label} ${at}: ${usageHint(alert.key)}`;
}

/** Cor da faixa: vermelha se algum aviso for crítico ou travado; senão amarela. */
export function bannerLevel(alerts: UsageAlert[]): "WARN" | "CRITICAL" | null {
  if (alerts.length === 0) return null;
  return alerts.some((a) => a.locked || a.level === "CRITICAL") ? "CRITICAL" : "WARN";
}
