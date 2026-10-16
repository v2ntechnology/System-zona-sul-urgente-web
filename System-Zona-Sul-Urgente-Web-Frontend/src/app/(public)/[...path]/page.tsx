import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { ArticleView } from "@/components/article/article-view";
import { CategoryView } from "@/components/category/category-view";
import { LISTING_FIRST_PAGE } from "@/components/listing/news-listing";
import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { shareImage } from "@/lib/media-url";
import { getByCategory, getSectionPaths, resolveSectionPath } from "@/services/news-service";
import { getSubcategories } from "@/services/taxonomy-service";

// Rota única na raiz (padrão CNN/g1): /{editoria}, /{editoria}/{sub}, /{editoria}/{slug},
// /{editoria}/{sub}/{slug}. Rotas fixas (busca, bairro, admin...) têm pasta própria e
// vencem esta rota dinâmica.
//
// SEO: a existência e a URL canônica são resolvidas ANTES de qualquer Suspense, para que
// 404 e o redirecionamento permanente (308) saiam como status HTTP de verdade.

// 'navigation': endereço não pré-gerado (ex.: matéria publicada depois do build) espera a
// página ficar pronta em vez de receber o App Shell com 200. Sem isso, 404 e 308 viram
// "200 + noindex" e redirecionamento via JavaScript — ruim para o Google.
export const ensureStatic = "navigation";
// A rota bloqueia de propósito (resolve existência/URL antes de responder, por causa do
// 404/308); isto avisa a validação de "navegação instantânea" do Next que é intencional.
export const instant = false;

export async function generateStaticParams() {
  return (await getSectionPaths()).map((path) => ({ path }));
}

export async function generateMetadata({ params }: PageProps<"/[...path]">): Promise<Metadata> {
  const { path } = await params;
  const resolved = await resolveSectionPath(path);
  if (!resolved || resolved.type === "redirect") return {};

  if (resolved.type === "category") {
    const { category } = resolved;
    return {
      title: category.name,
      description: category.description,
      alternates: {
        canonical: routes.category(category),
        types: {
          "application/rss+xml": [
            { url: routes.feed(category.slug), title: `${category.name} | ${siteConfig.name}` },
          ],
        },
      },
    };
  }

  const { news, canonicalPath } = resolved;
  const description = news.seo?.description ?? news.summary;
  const images = news.image
    ? [
        // Fotos enviadas pelo painel: og.jpg 1200×630 (WhatsApp/redes não lidam bem com WebP/AVIF).
        shareImage({
          url: news.image.url,
          width: news.image.width,
          height: news.image.height,
          alt: news.image.alt,
        }),
      ]
    : undefined;
  return {
    title: news.seo?.title ?? news.title,
    description,
    alternates: { canonical: news.seo?.canonicalUrl ?? canonicalPath },
    authors: news.authors.map((author) => ({ name: author.name })),
    openGraph: {
      type: "article",
      title: news.title,
      description,
      url: canonicalPath,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      publishedTime: news.publishedAt,
      modifiedTime: news.updatedAt ?? news.publishedAt,
      section: news.category.parent?.name ?? news.category.name,
      tags: news.tags.map((tag) => tag.name),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: news.title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}

export default async function SectionPage({ params }: PageProps<"/[...path]">) {
  const { path } = await params;
  const resolved = await resolveSectionPath(path);
  if (!resolved) notFound();
  if (resolved.type === "redirect") permanentRedirect(resolved.location);

  if (resolved.type === "news") {
    // Editoria mudou (ou URL veio torta): 308 para a URL atual, sem perder links antigos.
    if (resolved.canonicalPath !== `/${path.join("/")}`) permanentRedirect(resolved.canonicalPath);
    return <ArticleView news={resolved.news} />;
  }

  const { category } = resolved;
  const [listing, subcategories] = await Promise.all([
    getByCategory(category.slug, { limit: LISTING_FIRST_PAGE }),
    category.parent ? Promise.resolve([]) : getSubcategories(category.slug),
  ]);
  return (
    <CategoryView
      category={category}
      subcategories={subcategories}
      items={listing?.page.items ?? []}
      nextCursor={listing?.page.nextCursor ?? null}
    />
  );
}
