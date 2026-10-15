import { emptyDraft } from "@/lib/editor/validate";
import { escapeHtml } from "@/lib/html";
import { adminNewsMock, draftContentMock, instagramPostsMock } from "@/mocks/admin";
import { newsMock } from "@/mocks/news";
import type { NewsDraft } from "@/types/admin";

// Carrega notícias para o editor (FE-154). Depois: GET /api/v1/admin/news/{id}.

export async function getDraftForEdit(id: string): Promise<NewsDraft | null> {
  const row = adminNewsMock.find((n) => n.id === id);
  if (!row) return null;
  const full = newsMock.find((n) => n.id === id);
  const generated = draftContentMock[row.slug];
  const instagram = instagramPostsMock.find((p) => p.newsSlug && p.newsSlug === row.slug);

  return {
    ...emptyDraft(),
    id: row.id,
    title: row.title,
    subtitle: full?.subtitle ?? "",
    summary: full?.summary ?? generated?.summary ?? "",
    body:
      full?.body ??
      generated?.paragraphs.map((text) => ({
        type: "paragraph" as const,
        html: escapeHtml(text),
      })) ??
      [],
    categorySlug: row.category.slug,
    authorSlugs: full?.authors.map((a) => a.slug) ?? [],
    neighborhoodSlug: full?.location?.neighborhood?.slug ?? "",
    tagSlugs: full?.tags.map((t) => t.slug) ?? [],
    newTags: [],
    image: {
      url: full?.image?.url ?? "",
      alt: full?.image?.alt ?? "",
      caption: full?.image?.caption ?? "",
      credit: full?.image?.credit ?? "",
    },
    isUrgent: row.isUrgent,
    isSponsored: row.isSponsored,
    sponsorName: full?.sponsor?.name ?? "",
    seo: { title: full?.seo?.title ?? "", description: full?.seo?.description ?? "" },
    status: row.status,
    scheduledFor: row.scheduledFor ? toLocalInput(row.scheduledFor) : "",
    origin: row.origin,
    instagramCaption: instagram?.caption,
    updatedAt: row.updatedAt,
  };
}

/** ISO → "AAAA-MM-DDTHH:mm" no fuso de Brasília (valor do input datetime-local). */
function toLocalInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}
