import Link from "next/link";

import { AdSlot } from "@/components/ads/ad-slot";
import { Breadcrumbs } from "@/components/article/breadcrumbs";
import { Container } from "@/components/layout/container";
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
};

// Página de editoria (FE-104): cabeçalho na cor da editoria, subeditorias e listagem.
// Paginação ("carregar mais") entra na próxima etapa do FE-104.
export function CategoryView({ category, subcategories, items }: CategoryViewProps) {
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

      <NewsListing
        items={items}
        middle={<WhatsAppCta category={category} />}
        emptyMessage={`Ainda não há notícias publicadas em ${category.name}.`}
      />
    </Container>
  );
}
