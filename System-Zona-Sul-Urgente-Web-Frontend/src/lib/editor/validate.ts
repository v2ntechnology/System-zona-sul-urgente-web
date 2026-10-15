import { newTagError, TAG_LIMITS } from "@/lib/editor/tags";
import type { DraftErrors, NewsDraft, SaveIntent } from "@/types/admin";

// Regras do editor (FE-154). Rodam no navegador (resposta imediata) e de novo no servidor
// antes de salvar — a API também valida; nunca confiar só no frontend.

export const LIMITS = {
  title: { min: 10, max: 120 },
  subtitle: { max: 200 },
  summary: { min: 30, max: 300 },
  seoTitle: { max: 60 },
  seoDescription: { max: 160 },
};

/**
 * Rascunho só exige título (para o jornalista salvar cedo). Revisão, publicação e agendamento
 * exigem a matéria completa; agendar exige data futura; patrocinada exige o patrocinador.
 */
export function validateDraft(draft: NewsDraft, intent: SaveIntent, now = new Date()): DraftErrors {
  const errors: DraftErrors = {};
  const title = draft.title.trim();

  if (!title) errors.title = "Informe o título.";
  else if (title.length > LIMITS.title.max)
    errors.title = `Máximo de ${LIMITS.title.max} caracteres.`;

  if (draft.subtitle.length > LIMITS.subtitle.max)
    errors.subtitle = `Máximo de ${LIMITS.subtitle.max} caracteres.`;
  if (draft.summary.length > LIMITS.summary.max)
    errors.summary = `Máximo de ${LIMITS.summary.max} caracteres.`;

  const newTags = draft.newTags ?? [];
  const tagProblem = newTags.map(newTagError).find(Boolean);
  if (tagProblem) errors.newTags = tagProblem;
  else if (draft.tagSlugs.length + newTags.length > TAG_LIMITS.perNews)
    errors.newTags = `No máximo ${TAG_LIMITS.perNews} tópicos por matéria.`;

  if (intent === "draft") return errors;

  if (title && title.length < LIMITS.title.min)
    errors.title = `Mínimo de ${LIMITS.title.min} caracteres.`;
  if (draft.summary.trim().length < LIMITS.summary.min)
    errors.summary = `O resumo precisa de pelo menos ${LIMITS.summary.min} caracteres (aparece nos cards e no Google).`;
  if (!draft.body.some((b) => b.type === "paragraph")) errors.body = "Escreva o texto da matéria.";
  if (!draft.categorySlug) errors.categorySlug = "Escolha a editoria.";
  if (draft.authorSlugs.length === 0) errors.authorSlugs = "Escolha pelo menos um autor.";
  if (!draft.image.url.trim()) errors["image.url"] = "Adicione a foto principal.";
  else if (!draft.image.alt.trim())
    errors["image.alt"] = "Descreva a foto (texto alternativo) para acessibilidade.";
  if (draft.isSponsored && !draft.sponsorName.trim())
    errors.sponsorName = "Informe o patrocinador (identificação obrigatória).";

  if (intent === "schedule") {
    const when = draft.scheduledFor ? new Date(`${draft.scheduledFor}:00-03:00`) : null;
    if (!when || Number.isNaN(when.getTime()))
      errors.scheduledFor = "Escolha data e hora da publicação.";
    else if (when.getTime() <= now.getTime())
      errors.scheduledFor = "A data precisa estar no futuro.";
  }
  return errors;
}

/** Avisos que não bloqueiam (boas práticas de SEO). */
export function draftWarnings(draft: NewsDraft): string[] {
  const warnings: string[] = [];
  const seoTitle = draft.seo.title || draft.title;
  if (seoTitle.length > LIMITS.seoTitle.max)
    warnings.push(
      `Título para o Google com ${seoTitle.length} caracteres: acima de ${LIMITS.seoTitle.max} ele aparece cortado.`,
    );
  const seoDesc = draft.seo.description || draft.summary;
  if (seoDesc.length > LIMITS.seoDescription.max)
    warnings.push(
      `Descrição para o Google acima de ${LIMITS.seoDescription.max} caracteres aparece cortada.`,
    );
  if (draft.tagSlugs.length + (draft.newTags?.length ?? 0) === 0)
    warnings.push(
      'Sem tópicos: a matéria não aparece em "Tópicos" nem nas pesquisas relacionadas.',
    );
  return warnings;
}

export function emptyDraft(): NewsDraft {
  return {
    title: "",
    subtitle: "",
    summary: "",
    body: [],
    categorySlug: "",
    authorSlugs: [],
    neighborhoodSlug: "",
    tagSlugs: [],
    newTags: [],
    image: { url: "", alt: "", caption: "", credit: "" },
    isUrgent: false,
    isSponsored: false,
    sponsorName: "",
    seo: { title: "", description: "" },
    status: "DRAFT",
    scheduledFor: "",
    origin: "MANUAL",
  };
}
