import {
  adminNewsMock,
  draftContentMock,
  instagramConnectionMock,
  instagramPostsMock,
  type InstagramPostMock,
} from "@/mocks/admin";
import { MOCK_NOW, newsMock } from "@/mocks/news";
import { adminFetch, adminGet } from "@/services/admin/admin-api";
import { apiBaseUrl } from "@/services/api/client";
import type { InstagramConnection, InstagramImportStatus, InstagramPost } from "@/types/admin";

// Fila de importação do Instagram (FE-155). Com API_URL: GET /api/v1/admin/instagram/posts,
// /posts/counts e /connection; as ações ficam em app/admin/(painel)/instagram/actions.ts.
// Sem API: dados de exemplo.

/** Ordem das abas: o que pede ação primeiro. */
export const INSTAGRAM_STATUSES: InstagramImportStatus[] = [
  "NEW",
  "ERROR",
  "CHANGED_AT_SOURCE",
  "IMPORTED",
  "IGNORED",
  "REMOVED_AT_SOURCE",
];

export async function listInstagramPosts(status?: InstagramImportStatus): Promise<InstagramPost[]> {
  if (apiBaseUrl()) return (await adminGet<InstagramPost[]>("/instagram/posts", { status })) ?? [];
  return instagramPostsMock
    .filter((p) => !status || p.status === status)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .map(toPost);
}

/** Também alimenta o número no menu: erro (ex.: perfil sem instagram.review) vira zero. */
export async function countInstagramPostsByStatus(): Promise<Record<string, number>> {
  if (apiBaseUrl()) {
    const result = await adminFetch<Record<string, number>>("/instagram/posts/counts");
    return result.ok ? result.data : { ALL: 0 };
  }
  const counts: Record<string, number> = { ALL: instagramPostsMock.length };
  for (const p of instagramPostsMock) counts[p.status] = (counts[p.status] ?? 0) + 1;
  return counts;
}

/** null = conta ainda não conectada pela API da Meta (os posts entram por "Adicionar post"). */
export async function getInstagramConnection(): Promise<InstagramConnection | null> {
  if (apiBaseUrl()) return adminGet<InstagramConnection>("/instagram/connection");
  return {
    ...instagramConnectionMock,
    tokenDaysLeft: Math.floor(
      (Date.parse(instagramConnectionMock.tokenExpiresAt) - MOCK_NOW.getTime()) / 86_400_000,
    ),
  };
}

function toPost(p: InstagramPostMock): InstagramPost {
  const row = p.newsSlug ? adminNewsMock.find((n) => n.slug === p.newsSlug) : undefined;
  const full = row && newsMock.find((n) => n.id === row.id);
  const draft = row && draftContentMock[row.slug];
  return {
    id: p.id,
    caption: p.caption,
    currentCaption: p.currentCaption,
    permalink: p.permalink,
    mediaType: p.mediaType,
    mediaCount: p.mediaCount ?? 1,
    thumbnailUrl: `https://picsum.photos/seed/${p.id}/640/640`,
    postedAt: p.postedAt,
    status: p.status,
    news: row && {
      id: row.id,
      title: row.title,
      status: row.status,
      summary: full?.summary ?? draft?.summary ?? "",
      paragraphs:
        full?.body
          .filter((b) => b.type === "paragraph")
          .map((b) => b.html.replace(/<[^>]+>/g, "")) ??
        draft?.paragraphs ??
        [],
    },
    error: p.error,
    attempts: p.attempts,
    ignoredReason: p.ignoredReason,
    sourceChangedAt:
      p.sourceChangedHoursAgo === undefined
        ? undefined
        : new Date(MOCK_NOW.getTime() - p.sourceChangedHoursAgo * 3_600_000).toISOString(),
  };
}
