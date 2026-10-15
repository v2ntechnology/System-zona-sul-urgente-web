import { breakingNewsMock } from "@/mocks/breaking-news";
import type { BreakingNews } from "@/types/news";

// Camada de dados (FE-010). Hoje lê mocks; depois chama a API (/api/v1/public/news)
// com `use cache` + cacheTag(cacheTags.breaking()) — a assinatura não muda.

export async function getBreakingNews(): Promise<BreakingNews[]> {
  return breakingNewsMock;
}
