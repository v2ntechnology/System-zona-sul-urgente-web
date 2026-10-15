import { createHash, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { MAX_TAG_LENGTH } from "@/lib/cache-tags";

const MAX_TAGS_PER_REQUEST = 50;

// Chamado pela API após publicar/editar/despublicar (NewsPublishedEvent).
// Body: { "tags": ["news:slug", "home"] } · Header: Authorization: Bearer <REVALIDATE_SECRET>
// A purga da Cloudflare é feita pela API depois que esta chamada retorna 200.
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "revalidation disabled" }, { status: 503 });
  }

  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const tags = parseTags(await request.json().catch(() => null));
  if (!tags) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  // expire: 0 — correções e remoções editoriais/legais não podem servir conteúdo antigo.
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }

  return Response.json({ revalidated: tags });
}

function isAuthorized(header: string | null, secret: string): boolean {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  // Hash antes de comparar: timingSafeEqual exige tamanhos iguais.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(token), digest(secret));
}

function parseTags(body: unknown): string[] | null {
  if (typeof body !== "object" || body === null || !("tags" in body)) return null;
  const { tags } = body;
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS_PER_REQUEST) return null;
  const valid = tags.every(
    (tag): tag is string =>
      typeof tag === "string" && tag.length > 0 && tag.length <= MAX_TAG_LENGTH,
  );
  return valid ? [...new Set(tags)] : null;
}
