import Link from "next/link";

import { ColumnistAvatar } from "@/components/columns/columnist-avatar";
import { SectionHeader } from "@/components/home/section-header";
import { CarouselRow } from "@/components/ui/carousel-row";
import { routes } from "@/config/navigation";
import type { Category, NewsSummary } from "@/types/news";

// "Blogs e colunas" da home (estilo CNN): foto do colunista com aro vermelho, nome e o
// título do post mais recente. O nome leva à página da coluna; o título, ao post.
export function ColumnsRow({
  columns,
  section,
}: {
  columns: { column: Category; latest: NewsSummary }[];
  section: { slug: string; name: string };
}) {
  return (
    <CarouselRow
      label="Blogs e colunas"
      header={
        <SectionHeader
          id="colunas"
          title={section.name}
          href={routes.category(section)}
          linkLabel="Todas as colunas"
        />
      }
      className="border-b pb-8"
    >
      {columns.map(({ column, latest }) =>
        column.columnist ? (
          <article
            key={column.id}
            className="flex w-72 shrink-0 snap-start items-center gap-4 py-1.5 pl-1.5 sm:w-80"
          >
            <Link href={routes.category(column)} tabIndex={-1}>
              <ColumnistAvatar columnist={column.columnist} />
            </Link>
            <div className="flex min-w-0 flex-col gap-1">
              <Link
                href={routes.category(column)}
                className="font-heading text-base leading-tight font-bold hover:text-brand-blue"
              >
                {column.columnist.name}
                <span className="sr-only">, coluna {column.name}</span>
              </Link>
              <h3 className="line-clamp-3 font-sans text-sm leading-snug font-normal tracking-normal text-muted-foreground [font-stretch:normal]">
                <Link href={routes.news(latest)} className="hover:text-foreground hover:underline">
                  {latest.title}
                </Link>
              </h3>
            </div>
          </article>
        ) : null,
      )}
    </CarouselRow>
  );
}
