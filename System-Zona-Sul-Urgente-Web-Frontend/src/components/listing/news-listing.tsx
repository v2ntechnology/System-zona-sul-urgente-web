import { NewsCard, NewsCardCompact, NewsCardFeatured } from "@/components/news/news-card";
import type { NewsSummary } from "@/types/news";

type NewsListingProps = {
  items: NewsSummary[];
  /** Conteúdo entre o destaque e a grade (ex.: chamada do canal de WhatsApp). */
  middle?: React.ReactNode;
  /** Texto quando não há notícias. */
  emptyMessage: string;
};

// Listagem de editoria/bairro: destaque + 3 compactos ao lado + grade com o restante.
// Patrocinada nunca é o destaque principal (vai para a lista, com selo).
export function NewsListing({ items, middle, emptyMessage }: NewsListingProps) {
  const lead = items.find((news) => !news.isSponsored) ?? items[0];
  if (!lead) {
    return <p className="py-16 text-center text-muted-foreground">{emptyMessage}</p>;
  }
  const others = items.filter((news) => news !== lead);
  const side = others.slice(0, 3);
  const rest = others.slice(3);

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <NewsCardFeatured news={lead} preload />
        {side.length > 0 && (
          <div className="flex flex-col divide-y">
            {side.map((news) => (
              <NewsCardCompact key={news.id} news={news} className="py-4 first:pt-0" />
            ))}
          </div>
        )}
      </div>
      {middle}
      {rest.length > 0 && (
        <div className="grid gap-8 border-t pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((news) => (
            <NewsCard key={news.id} news={news} />
          ))}
        </div>
      )}
    </>
  );
}
