import { categories, neighborhoods } from "@/mocks/taxonomy";
import type { Category, Neighborhood } from "@/types/news";

// Taxonomia (FE-010). Hoje lê mocks; depois GET /api/v1/public/categories e /neighborhoods.

export async function getCategories(): Promise<Category[]> {
  return categories;
}

export async function getNeighborhoods(): Promise<Neighborhood[]> {
  return neighborhoods;
}
