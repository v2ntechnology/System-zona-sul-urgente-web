import Link from "next/link";

import { AdSlot } from "@/components/ads/ad-slot";
import { Breadcrumbs } from "@/components/article/breadcrumbs";
import { ColumnistAvatar } from "@/components/columns/columnist-avatar";
import { Container } from "@/components/layout/container";
import { LoadMore } from "@/components/listing/load-more";
import { NewsListing } from "@/components/listing/news-listing";
import { WhatsAppCta } from "@/components/news/whatsapp-cta";
import { sectionStyle } from "@/lib/section-color";
import { routes } from "@/config/navigation";
import { breadcrumbJsonLd, type Crumb, serializeJsonLd } from "@/lib/structured-data";
import type { Category, NewsSummary } from "@/types/news";

type CategoryViewProps = {
  category: Category;
  subcategories: Category[];
  items: NewsSummary[];
  nextCursor: string | null;
};

// Página de editoria (FE-104): cabeçalho na cor da editoria, subeditorias e listagem.
// Paginação ("carregar mais") entra na próxima etapa do FE-104.
export function CategoryView({ category, subcategories, items, nextCursor }: CategoryViewProps) {
  const crumbs: Crumb[] = [
    { name: "Início", path: routes.home },
    ...(category.parent
      ? [{ name: category.parent.name, path: routes.category(category.parent) }]
      : []),
    { name: category.name, path: routes.category(category) },
  ];

  return (
    <Container className="flex flex-col gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }}
      />
      <header className="flex flex-col gap-3 border-b pb-6">
        <Breadcrumbs crumbs={crumbs} />
        {category.columnist ? (
          // Página de uma coluna: o colunista é o protagonista.
          <div className="flex items-center gap-5">
            <ColumnistAvatar columnist={category.columnist} size="lg" />
            <div className="flex flex-col gap-1">
              <h1 className="text-display">{category.name}</h1>
              <p className="text-title font-normal">
                por <strong className="font-bold">{category.columnist.name}</strong>
              </p>
              <p className="text-sm text-muted-foreground">{category.columnist.bio}</p>
            </div>
          </div>
        ) : (
          <>
            <h1 style={sectionStyle(category)} className="text-display text-[color:var(--section)]">
              {category.name}
              <span
                aria-hidden
                className="ml-1 inline-block size-[0.24em] bg-[color:var(--section)]"
              />
            </h1>
            {category.description && (
              <p className="max-w-prose text-muted-foreground">{category.description}</p>
            )}
          </>
        )}
        {subcategories.some((sub) => sub.columnist) ? (
          <nav aria-label="Colunistas">
            <ul className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {subcategories.map((sub) =>
                sub.columnist ? (
                  <li key={sub.id}>
                    <Link
                      href={routes.category(sub)}
                      className="group flex items-center gap-4 rounded-xl border p-4 transition hover:border-brand-red"
                    >
                      <ColumnistAvatar columnist={sub.columnist} />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-heading font-bold group-hover:text-brand-blue">
                          {sub.columnist.name}
                        </span>
                        <span className="text-sm font-semibold text-brand-red">{sub.name}</span>
                        <span className="text-xs text-muted-foreground">{sub.columnist.bio}</span>
                      </span>
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </nav>
        ) : (
          subcategories.length > 0 && (
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
          )
        )}
      </header>

      <AdSlot slotKey="CATEGORY_TOP" />

      <NewsListing
        items={items}
        middle={<WhatsAppCta category={category} />}
        emptyMessage={`Ainda não há notícias publicadas em ${category.name}.`}
        footer={<LoadMore filter={{ editoria: category.slug }} initialCursor={nextCursor} />}
      />
    </Container>
  );
}
