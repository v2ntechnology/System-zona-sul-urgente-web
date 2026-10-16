import { RemoteImage } from "@/components/media/remote-image";
import Link from "next/link";

import { SectionHeader } from "@/components/home/section-header";
import { CarouselRow } from "@/components/ui/carousel-row";
import { routes } from "@/config/navigation";
import { sectionStyle } from "@/lib/section-color";
import { cn } from "@/lib/utils";
import { getMostRead } from "@/services/news-service";
import type { NewsSummary } from "@/types/news";

// "Mais Lidas" (FE-107), nos dois formatos da CNN:
//  - MostReadRow: faixa horizontal com número sobre a foto (home)
//  - MostReadList: coluna com a 1ª em destaque e as demais com miniatura (lateral da matéria)
// Ranking das últimas 24 h; patrocinadas ficam de fora (regra do service).

export async function MostReadRow({ className }: { className?: string }) {
  const items = await getMostRead("24h", 5);
  if (items.length === 0) return null;
  return (
    <CarouselRow
      label="Mais lidas"
      header={<SectionHeader id="mais-lidas" title="Mais Lidas" />}
      className={className}
    >
      {items.map((news, index) => (
        <article
          key={news.id}
          className="group relative w-64 shrink-0 snap-start sm:w-auto sm:flex-1 sm:basis-0"
        >
          <Thumb news={news} sizes="(min-width: 1024px) 20vw, 256px" className="aspect-[16/9.5]">
            <span className="absolute top-2 left-2 z-1 flex size-6 items-center justify-center bg-brand-red text-xs font-bold text-white tabular-nums">
              {index + 1}
            </span>
          </Thumb>
          <TitleLink news={news} className="mt-3" />
        </article>
      ))}
    </CarouselRow>
  );
}

export async function MostReadList({ className }: { className?: string }) {
  const [lead, ...rest] = await getMostRead("24h", 5);
  if (!lead) return null;
  return (
    <section aria-labelledby="mais-lidas" className={className}>
      <SectionHeader id="mais-lidas" title="Mais Lidas" className="mb-4" />
      <article className="group relative">
        <Thumb news={lead} sizes="320px" className="aspect-[16/9] rounded-md" />
        <TitleLink news={lead} className="mt-3" />
      </article>
      <ol className="mt-4 flex flex-col divide-y border-t">
        {rest.map((news) => (
          <li key={news.id} className="group relative flex items-center gap-4 py-4">
            <Thumb news={news} sizes="112px" className="aspect-[7/6] w-28 shrink-0 rounded-md" />
            <TitleLink news={news} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Thumb({
  news,
  sizes,
  className,
  children,
}: {
  news: NewsSummary;
  sizes: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {news.image && (
        <RemoteImage
          src={news.image.url}
          alt={news.image.alt}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
        />
      )}
      <span
        aria-hidden
        style={sectionStyle(news.category)}
        className="absolute top-0 left-0 h-1 w-6 bg-[color:var(--section)]"
      />
      {children}
    </div>
  );
}

function TitleLink({ news, className }: { news: NewsSummary; className?: string }) {
  return (
    <h3 className={cn("font-heading text-teaser font-bold", className)}>
      <Link
        href={routes.news(news)}
        className="group-hover:text-brand-blue after:absolute after:inset-0 after:z-10"
      >
        {news.title}
      </Link>
    </h3>
  );
}
