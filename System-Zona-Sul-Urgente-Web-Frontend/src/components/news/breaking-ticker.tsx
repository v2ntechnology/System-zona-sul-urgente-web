import Link from "next/link";

import { routes } from "@/config/navigation";
import { getBreakingNews } from "@/services/news-service";
import type { BreakingNews } from "@/types/news";

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

// Faixa de notícias urgentes (FE-108): letreiro em CSS, sem JavaScript no cliente.
// Pausa com mouse/foco; com "reduzir movimento" vira faixa estática rolável.
// Sem urgentes no momento, não renderiza nada.
export async function BreakingTicker() {
  const items = await getBreakingNews();
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Notícias urgentes"
      className="ticker flex bg-urgent text-urgent-foreground"
    >
      <div className="z-10 flex shrink-0 items-center gap-2 bg-brand-blue-dark px-3 text-label font-bold tracking-wider uppercase sm:px-4">
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-red opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-brand-red" />
        </span>
        Urgente
      </div>
      <div className="ticker-viewport relative min-w-0 flex-1 overflow-hidden">
        <div className="ticker-track flex w-max">
          <TickerList items={items} />
          {/* Cópia para o loop contínuo; invisível para leitores de tela e teclado. */}
          <TickerList items={items} hidden />
        </div>
      </div>
    </section>
  );
}

function TickerList({ items, hidden }: { items: BreakingNews[]; hidden?: boolean }) {
  return (
    <ul className="flex shrink-0" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center">
          <Link
            href={routes.news(item.slug)}
            tabIndex={hidden ? -1 : undefined}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold whitespace-nowrap hover:underline focus-visible:outline-white"
          >
            <time dateTime={item.publishedAt} className="font-normal tabular-nums opacity-85">
              {timeFormat.format(new Date(item.publishedAt))}
            </time>
            {item.title}
          </Link>
          <span aria-hidden className="size-1 rounded-full bg-white/60" />
        </li>
      ))}
    </ul>
  );
}
