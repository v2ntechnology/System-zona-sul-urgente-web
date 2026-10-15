// Convenção única de cache tags. A API (Spring) envia estas mesmas strings para
// /api/revalidate quando uma notícia é publicada, editada ou despublicada.
export const cacheTags = {
  home: () => "home",
  newsList: () => "news",
  news: (slug: string) => `news:${slug}`,
  category: (slug: string) => `category:${slug}`,
  city: (slug: string) => `city:${slug}`,
  neighborhood: (slug: string) => `neighborhood:${slug}`,
  author: (slug: string) => `author:${slug}`,
} as const;

// Limite do Next para tags (strings maiores nunca são associadas ao cache).
export const MAX_TAG_LENGTH = 256;
