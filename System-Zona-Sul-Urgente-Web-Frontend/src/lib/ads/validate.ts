import type { CampaignDraft } from "@/types/admin";
import type { AdSize, AdSlotKey } from "@/types/news";

// Regras de campanha e anunciante (FE-157). Rodam no navegador e de novo no servidor; a
// API também valida.

export type CampaignErrors = Partial<Record<keyof CampaignDraft | `creative-${AdSlotKey}`, string>>;

/** Imagem serve para a posição só se tiver exatamente um dos tamanhos aceitos. */
export function sizeFits(size: { width: number; height: number }, accepted: AdSize[]): boolean {
  return accepted.some((a) => a.width === size.width && a.height === size.height);
}

export const formatSize = (s: AdSize) => `${s.width}×${s.height}`;

export function validateCampaign(
  draft: CampaignDraft,
  slotSizes: Record<AdSlotKey, AdSize[]>,
  intent: "draft" | "submit",
  today = new Date(),
): CampaignErrors {
  const errors: CampaignErrors = {};
  if (draft.name.trim().length < 3) errors.name = "Dê um nome à campanha (3+ letras).";
  if (!draft.advertiserId) errors.advertiserId = "Escolha o anunciante.";
  if (intent === "draft") return errors;

  const start = draft.startsAt ? new Date(`${draft.startsAt}T00:00:00-03:00`) : null;
  const end = draft.endsAt ? new Date(`${draft.endsAt}T23:59:59-03:00`) : null;
  const dayStart = new Date(today);
  dayStart.setHours(0, 0, 0, 0);
  if (!start || Number.isNaN(start.getTime())) errors.startsAt = "Escolha a data de início.";
  else if (start.getTime() < dayStart.getTime() - 86_400_000)
    errors.startsAt = "O início não pode estar no passado.";
  if (!end || Number.isNaN(end.getTime())) errors.endsAt = "Escolha a data de fim.";
  else if (start && end.getTime() <= start.getTime())
    errors.endsAt = "O fim precisa ser depois do início.";

  if (draft.slots.length === 0) errors.slots = "Escolha pelo menos uma posição.";
  if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(draft.clickUrl.trim()))
    errors.clickUrl = "Use um link completo começando com https://.";
  if (draft.goalImpressions && !/^\d+$/.test(draft.goalImpressions.replace(/\./g, "")))
    errors.goalImpressions = "Use só números.";

  for (const slot of draft.slots) {
    const creative = draft.creatives[slot];
    const accepted = slotSizes[slot];
    if (!creative) errors[`creative-${slot}`] = "Envie a peça desta posição.";
    else if (!sizeFits(creative, accepted))
      errors[`creative-${slot}`] =
        `A imagem tem ${formatSize(creative)}; esta posição aceita ${accepted.map(formatSize).join(", ")}.`;
    else if (!creative.alt.trim())
      errors[`creative-${slot}`] = "Descreva a peça (texto alternativo).";
  }
  return errors;
}

/** CNPJ com dígitos verificadores válidos (aceita com ou sem máscara). */
export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const check = (base: string) => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = [...base].reduce((s, d, i) => s + Number(d) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = check(digits.slice(0, 12));
  const second = check(digits.slice(0, 12) + first);
  return digits.endsWith(`${first}${second}`);
}

export function formatCnpj(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
