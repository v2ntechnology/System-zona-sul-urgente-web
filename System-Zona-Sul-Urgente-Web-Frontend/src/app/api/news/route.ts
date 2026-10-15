import { ServiceError } from "@/services/errors";
import { getByCategory, getByNeighborhood } from "@/services/news-service";

const PAGE_SIZE = 12;

// Próximas páginas das listagens ("Carregar mais", FE-104/FE-105).
// GET /api/news?editoria={slug}&cursor=... ou ?bairro={slug}&cursor=...
// Resposta: { items: NewsSummary[], nextCursor: string | null }.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = params.get("editoria");
  const neighborhood = params.get("bairro");
  const cursor = params.get("cursor");

  if (!cursor || Boolean(category) === Boolean(neighborhood)) {
    return Response.json(
      { error: "Informe cursor e exatamente um filtro: editoria ou bairro." },
      { status: 400 },
    );
  }

  try {
    const result = category
      ? await getByCategory(category, { cursor, limit: PAGE_SIZE })
      : await getByNeighborhood(neighborhood!, { cursor, limit: PAGE_SIZE });
    if (!result) return Response.json({ error: "Não encontrado." }, { status: 404 });
    const { items, nextCursor } = result.page;
    return Response.json(
      { items, nextCursor },
      // Mesma página de resultados por alguns minutos na CDN; a revalidação de publicação
      // não precisa limpar isto (o pior caso é ver a 2ª página com até 5 min de atraso).
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
    );
  } catch (error) {
    if (error instanceof ServiceError && error.code === "BAD_REQUEST") {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
