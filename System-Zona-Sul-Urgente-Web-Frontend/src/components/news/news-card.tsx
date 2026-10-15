import { PlayIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Kicker, SponsoredBadge, UrgentBadge } from "@/components/news/news-badges";
import { RelativeTime } from "@/components/news/relative-time";
import { routes } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { NewsSummary } from "@/types/news";

// Cards de notícia (FE-102). Padrão de acessibilidade: um único link por card (o título),
// esticado com ::after para o card inteiro ser clicável sem links aninhados.

type CardProps = {
  news: NewsSummary;
  className?: string;
  /** Carrega a foto com prioridade (só na manchete, acima da dobra). */
  preload?: boolean;
};

// ---------------------------------------------------------------- partes comuns

function cardHref(news: NewsSummary) {
  return routes.news(news);
}

function TitleLink({
  news,
  className,
  overlay,
}: {
  news: NewsSummary;
  className?: string;
  overlay?: boolean;
}) {
  return (
    <Link
      href={cardHref(news)}
      className={cn(
        "after:absolute after:inset-0 after:z-10 focus-visible:outline-none",
        overlay
          ? "decoration-2 underline-offset-4 group-hover:underline"
          : "transition-colors group-hover:text-brand-blue",
        className,
      )}
    >
      {news.title}
    </Link>
  );
}

/** Selos + chapéu. Patrocinada sempre mostra o selo (identificação obrigatória). */
function CardLabels({ news, onDark }: { news: NewsSummary; onDark?: boolean }) {
  const place = news.location?.neighborhood?.name;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {news.isUrgent && <UrgentBadge />}
      {news.isSponsored ? (
        <SponsoredBadge />
      ) : (
        <Kicker className={onDark ? "text-white" : undefined}>
          {news.category.name}
          {place && (
            <span className={onDark ? "text-white/80" : "text-muted-foreground"}> · {place}</span>
          )}
        </Kicker>
      )}
    </div>
  );
}

function CardImage({
  news,
  sizes,
  preload,
  className,
  playSize = "md",
}: {
  news: NewsSummary;
  sizes: string;
  preload?: boolean;
  className?: string;
  playSize?: "sm" | "md" | "lg";
}) {
  return (
    <div className={cn("relative aspect-video overflow-hidden bg-muted", className)}>
      {news.image && (
        <Image
          src={news.image.url}
          alt={news.image.alt}
          fill
          sizes={sizes}
          preload={preload}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      )}
      {/* Acento vermelho no canto, como na CNN. */}
      <span aria-hidden className="absolute top-0 left-0 h-1 w-8 bg-brand-red" />
      {news.hasVideo && <PlayBadge size={playSize} />}
    </div>
  );
}

function PlayBadge({ size }: { size: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-label="Contém vídeo"
      role="img"
      className={cn(
        "absolute bottom-2 left-2 z-1 flex items-center justify-center rounded-full bg-black/60 text-white ring-2 ring-white/80 backdrop-blur-sm transition-transform group-hover:scale-110",
        size === "sm" && "size-7",
        size === "md" && "size-10",
        size === "lg" && "top-1/2 bottom-auto left-1/2 size-16 -translate-x-1/2 -translate-y-1/2",
      )}
    >
      <PlayIcon className={cn("fill-current", size === "lg" ? "size-7" : "size-4")} aria-hidden />
    </span>
  );
}

function Time({ news, className }: { news: NewsSummary; className?: string }) {
  return (
    <RelativeTime
      iso={news.updatedAt ?? news.publishedAt}
      className={cn("text-xs text-muted-foreground", className)}
    />
  );
}

// ---------------------------------------------------------------- variantes

/** Manchete da home: foto grande, título display, resumo e links relacionados. */
export function NewsCardFeatured({
  news,
  related = [],
  className,
  preload,
}: CardProps & { related?: NewsSummary[] }) {
  return (
    <article className={cn("flex flex-col gap-4", className)}>
      <div className="group relative flex flex-col gap-3">
        <CardImage
          news={news}
          sizes="(min-width: 1024px) 60vw, 100vw"
          preload={preload}
          playSize="lg"
        />
        <CardLabels news={news} />
        <h2 className="text-display">
          <TitleLink news={news} />
        </h2>
        {news.subtitle && (
          <p className="text-title font-normal text-muted-foreground">{news.subtitle}</p>
        )}
        <Time news={news} />
      </div>
      {related.length > 0 && (
        <ul className="flex flex-col gap-2 border-t pt-3">
          {related.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1.5 size-2.5 shrink-0 bg-kicker" />
              <Link
                href={cardHref(item)}
                className="font-medium hover:text-brand-blue hover:underline"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Título sobre a foto com degradê (destaques secundários, estilo g1). */
export function NewsCardOverlay({ news, className, preload }: CardProps) {
  return (
    <article className={cn("group relative overflow-hidden bg-brand-blue-dark", className)}>
      <CardImage
        news={news}
        sizes="(min-width: 1024px) 30vw, 100vw"
        preload={preload}
        className="aspect-[4/3] sm:aspect-video lg:aspect-[4/3]"
        playSize="sm"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 text-white">
        <CardLabels news={news} onDark />
        <h3 className="text-title text-white drop-shadow">
          <TitleLink news={news} overlay />
        </h3>
      </div>
    </article>
  );
}

/** Card padrão: foto em cima, chapéu, título. */
export function NewsCard({ news, className }: CardProps) {
  return (
    <article className={cn("group relative flex flex-col gap-2.5", className)}>
      <CardImage news={news} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" />
      <CardLabels news={news} />
      <h3 className="text-title">
        <TitleLink news={news} />
      </h3>
      <Time news={news} />
    </article>
  );
}

/** Foto ao lado, com resumo no desktop (feed de últimas). */
export function NewsCardHorizontal({ news, className }: CardProps) {
  return (
    <article className={cn("group relative flex gap-4", className)}>
      <CardImage
        news={news}
        sizes="(min-width: 640px) 240px, 128px"
        className="w-32 shrink-0 self-start sm:w-60"
        playSize="sm"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <CardLabels news={news} />
        <h3 className="font-heading text-teaser font-bold sm:text-title">
          <TitleLink news={news} />
        </h3>
        <p className="hidden text-sm text-muted-foreground sm:line-clamp-2">{news.summary}</p>
        <Time news={news} />
      </div>
    </article>
  );
}

/** Miniatura pequena + título (faixas de 4 colunas). */
export function NewsCardCompact({ news, className }: CardProps) {
  return (
    <article className={cn("group relative flex gap-3", className)}>
      <CardImage news={news} sizes="112px" className="w-28 shrink-0 self-start" playSize="sm" />
      <div className="flex min-w-0 flex-col gap-1">
        <CardLabels news={news} />
        <h3 className="line-clamp-3 font-heading text-teaser font-bold">
          <TitleLink news={news} />
        </h3>
      </div>
    </article>
  );
}

/** Card de vídeo para a faixa escura da home. */
export function NewsCardVideo({ news, className }: CardProps) {
  return (
    <article className={cn("group relative flex flex-col gap-3 text-white", className)}>
      <CardImage
        news={news}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        playSize="lg"
      />
      <CardLabels news={news} onDark />
      <h3 className="text-title text-white">
        <TitleLink news={news} overlay />
      </h3>
    </article>
  );
}
