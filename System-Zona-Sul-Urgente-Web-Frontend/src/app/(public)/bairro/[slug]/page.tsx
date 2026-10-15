import { MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdSlot } from "@/components/ads/ad-slot";
import { Breadcrumbs } from "@/components/article/breadcrumbs";
import { SectionHeader } from "@/components/home/section-header";
import { Container } from "@/components/layout/container";
import { NewsListing } from "@/components/listing/news-listing";
import { WhatsAppCta } from "@/components/news/whatsapp-cta";
import { routes } from "@/config/navigation";
import { breadcrumbJsonLd, type Crumb, serializeJsonLd } from "@/lib/structured-data";
import { getByNeighborhood } from "@/services/news-service";
import { getNeighborhoods } from "@/services/taxonomy-service";

// Página de bairro (FE-105). Mesma regra das editorias: pré-gerada e com 404 real
// (ver comentário de ensureStatic em [...path]/page.tsx).
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return (await getNeighborhoods()).map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: PageProps<"/bairro/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getByNeighborhood(slug);
  if (!result) return {};
  const { neighborhood } = result;
  return {
    title: `${neighborhood.name}: notícias do bairro`,
    description: `Últimas notícias de ${neighborhood.name}, na ${neighborhood.zone.name} do Rio de Janeiro: segurança, trânsito, cidade, comércio e eventos.`,
    alternates: { canonical: routes.neighborhood(neighborhood.slug) },
  };
}

export default async function NeighborhoodPage({ params }: PageProps<"/bairro/[slug]">) {
  const { slug } = await params;
  const [result, all] = await Promise.all([
    getByNeighborhood(slug, { limit: 24 }),
    getNeighborhoods(),
  ]);
  if (!result) notFound();

  const { neighborhood, page } = result;
  const others = all.filter(
    (n) => n.zone.slug === neighborhood.zone.slug && n.slug !== neighborhood.slug,
  );
  const crumbs: Crumb[] = [
    { name: "Início", path: routes.home },
    { name: neighborhood.name, path: routes.neighborhood(neighborhood.slug) },
  ];

  return (
    <Container className="flex flex-col gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }}
      />
      <header className="flex flex-col gap-3 border-b pb-6">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="text-display text-brand-blue">
          {neighborhood.name}
          <span aria-hidden className="ml-1 inline-block size-[0.24em] bg-brand-red" />
        </h1>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <MapPinIcon aria-hidden className="size-4" />
          {neighborhood.zone.name} · Rio de Janeiro
        </p>
      </header>

      <AdSlot slotKey="CATEGORY_TOP" />

      <NewsListing
        items={page.items}
        middle={<WhatsAppCta />}
        emptyMessage={`Ainda não há notícias recentes de ${neighborhood.name}. Envie a sua pelo botão "Envie sua notícia".`}
      />

      {others.length > 0 && (
        <section aria-labelledby="outros-bairros" className="border-t pt-8">
          <SectionHeader
            id="outros-bairros"
            title={`Outros bairros da ${neighborhood.zone.name}`}
          />
          <ul className="flex flex-wrap gap-2">
            {others.map((n) => (
              <li key={n.id}>
                <Link
                  href={routes.neighborhood(n.slug)}
                  className="inline-flex rounded-full border px-4 py-2 text-sm font-medium transition hover:border-brand-blue hover:bg-brand-blue hover:text-white"
                >
                  {n.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
