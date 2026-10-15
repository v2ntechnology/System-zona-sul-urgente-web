import Link from "next/link";

import { AdSlot } from "@/components/ads/ad-slot";
import { Breadcrumbs } from "@/components/article/breadcrumbs";
import { Container } from "@/components/layout/container";
import { NewsCard, NewsCardCompact, NewsCardFeatured } from "@/components/news/news-card";
import { WhatsAppCta } from "@/components/news/whatsapp-cta";
import { sectionStyle } from "@/lib/section-color";
import { routes } from "@/config/navigation";
import { breadcrumbJsonLd, type Crumb, serializeJsonLd } from "@/lib/structured-data";
import type { Category, NewsSummary } from "@/types/news";

type CategoryViewProps = {
  category: Category;
  subcategories: Category[];
  items: NewsSummary[];
};

// Página de editoria (FE-104, primeira versão): destaque + grade. Paginação ("carregar mais")
// entra na próxima etapa do FE-104.
export function CategoryView({ category, subcategories, items }: CategoryViewProps) {
  const crumbs: Crumb[] = [
    { name: "Início", path: routes.home },
    ...(category.parent
      ? [{ name: category.parent.name, path: routes.category(category.parent) }]
      : []),
    { name: category.name, path: routes.category(category) },
  ];
  // Patrocinada nunca é o destaque principal da editoria (vai para a lista, com selo).
  const lead = items.find((news) => !news.isSponsored) ?? items[0];
  const others = items.filter((news) => news !== lead);
  const side = others.slice(0, 3);
  const rest = others.slice(3);

  return (
    <Container className="flex flex-col gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }}
      />
      <header className="flex flex-col gap-3 border-b pb-6">
        <Breadcrumbs crumbs={crumbs} />
        <h1 style={sectionStyle(category)} className="text-display text-[color:var(--section)]">
          {category.name}
          <span aria-hidden className="ml-1 inline-block size-[0.24em] bg-[color:var(--section)]" />
        </h1>
        {category.description && (
          <p className="max-w-prose text-muted-foreground">{category.description}</p>
        )}
        {subcategories.length > 0 && (
          <nav aria-label={`Subeditorias de ${category.name}`}>
            <ul className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <li key={sub.id}>
                  <Link
                    href={routes.category(sub)}
                    className="inline-flex rounded-full border px-4 py-1.5 text-sm font-medium transition hover:border-brand-blue hover:bg-brand-blue hover:text-white"
                  >
                    {sub.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <AdSlot slotKey="CATEGORY_TOP" />

      {lead ? (
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
          <WhatsAppCta category={category} />
          {rest.length > 0 && (
            <div className="grid gap-8 border-t pt-8 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((news) => (
                <NewsCard key={news.id} news={news} />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="py-16 text-center text-muted-foreground">
          Ainda não há notícias publicadas em {category.name}.
        </p>
      )}
    </Container>
  );
}
