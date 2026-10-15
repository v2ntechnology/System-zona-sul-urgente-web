import { storiesMock } from "@/mocks/stories";
import type { WebStory } from "@/types/news";

// Web Stories (FE-119). Hoje lê mocks; depois GET /api/v1/public/stories.

export async function getLatestStories(limit = 10): Promise<WebStory[]> {
  return [...storiesMock]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

export async function getStoryBySlug(slug: string): Promise<WebStory | null> {
  return storiesMock.find((story) => story.slug === slug) ?? null;
}
