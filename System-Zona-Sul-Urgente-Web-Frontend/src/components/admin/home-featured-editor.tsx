"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  Loader2Icon,
  SaveIcon,
  SearchIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { saveHomeFeatured, searchPublishedNews } from "@/app/admin/(painel)/destaques/actions";
import { RemoteImage } from "@/components/media/remote-image";
import { RelativeTime } from "@/components/news/relative-time";
import {
  move,
  normalize,
  place,
  remove,
  sectionOf,
  type Section,
  type Slots,
} from "@/lib/home-featured";
import { cn } from "@/lib/utils";
import type { HomeFeatured, HomeFeaturedNews } from "@/types/admin";

const button =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-semibold transition hover:border-brand-blue hover:text-brand-blue disabled:pointer-events-none disabled:opacity-50";
const primaryButton =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-brand-blue-dark disabled:pointer-events-none disabled:opacity-60";
const iconButton =
  "inline-flex size-8 items-center justify-center rounded-md border bg-background transition hover:border-brand-blue hover:text-brand-blue disabled:pointer-events-none disabled:opacity-30";

const SECTIONS: { name: Section; positions: number[]; hint: string }[] = [
  { name: "Manchete", positions: [1], hint: "Foto grande no topo da home." },
  { name: "Destaques ao lado", positions: [2, 3], hint: "Ao lado da manchete." },
  {
    name: "Faixa",
    positions: [4, 5, 6, 7],
    hint: "Logo abaixo; completada pelas últimas notícias.",
  },
  { name: "Reserva", positions: [8, 9, 10], hint: "Guardadas; não aparecem na home atual." },
];

type State = { ids: Slots; cards: Record<string, HomeFeaturedNews>; signature: string };

function fromServer(featured: HomeFeatured): State {
  const cards: Record<string, HomeFeaturedNews> = {};
  const ids = normalize(
    featured.slots
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((s) => {
        if (s.news) cards[s.news.id] = s.news;
        return s.news?.id ?? null;
      }),
  );
  return { ids, cards, signature: featured.signature };
}

// Destaques da home (spec 003): o Editor monta o topo (manchete, 2 ao lado, faixa de 4 e 3 de
// reserva), vê a prévia e salva. As regras de deslocamento são as mesmas da API (@/lib/home-featured).
// Salvar manda a ordem inteira com a assinatura; se outra pessoa salvou antes, mostra a ordem atual.
export function HomeFeaturedEditor({ initial }: { initial: HomeFeatured }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => fromServer(initial));
  const [state, setState] = useState(saved);
  const [automatic, setAutomatic] = useState(initial.automaticMain ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HomeFeaturedNews[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [searching, startSearch] = useTransition();
  const dragged = useRef<number | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(state.ids) !== JSON.stringify(saved.ids),
    [state.ids, saved.ids],
  );
  const isSponsored = (id: string) => Boolean(state.cards[id]?.isSponsored);

  // Aviso ao sair com mudanças não salvas: fechar/recarregar a aba e links do painel. O "voltar" do
  // navegador fica sem aviso (o App Router não tem evento confiável para isso).
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest("a[href]");
      if (
        link &&
        !window.confirm("Você tem mudanças nos destaques que não foram salvas. Sair mesmo assim?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // Busca de publicadas (a cada digitação, com pequena espera).
  useEffect(() => {
    const timer = setTimeout(() => {
      startSearch(async () => setResults(await searchPublishedNews(query)));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function update(ids: Slots, extra?: HomeFeaturedNews) {
    setState((s) => ({
      ...s,
      ids,
      cards: extra ? { ...s.cards, [extra.id]: extra } : s.cards,
    }));
    setNotice(null);
  }

  function put(news: HomeFeaturedNews, position: number) {
    const cards = { ...state.cards, [news.id]: news };
    try {
      const ids = place(state.ids, news.id, position, (id) => Boolean(cards[id]?.isSponsored));
      update(ids, news);
    } catch (error) {
      setNotice({ tone: "warn", text: (error as Error).message });
    }
  }

  function save() {
    startTransition(async () => {
      const result = await saveHomeFeatured(state.ids, state.signature);
      if (!result.ok && result.message === "simulated") {
        setNotice({
          tone: "warn",
          text: "Demonstração: sem a API, os destaques não são salvos de verdade.",
        });
        return;
      }
      if (!result.ok) {
        if ("conflict" in result && result.conflict) {
          const current = fromServer(result.conflict);
          setSaved(current);
          setState(current);
          setAutomatic(result.conflict.automaticMain ?? null);
          setNotice({
            tone: "error",
            text: "Outra pessoa mudou os destaques enquanto você editava. Esta é a ordem atual: refaça a mudança e salve.",
          });
        } else {
          setNotice({ tone: "error", text: result.message });
        }
        return;
      }
      const next = fromServer(result.featured);
      setSaved(next);
      setState(next);
      setAutomatic(result.featured.automaticMain ?? null);
      setNotice({ tone: "ok", text: "Destaques salvos. A home já mostra o topo novo." });
      router.refresh();
    });
  }

  const card = (position: number) => {
    const id = state.ids[position - 1];
    return id ? state.cards[id] : null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Só notícias publicadas. Arraste ou use as setas para reordenar; nada muda no site até
          salvar.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className={button}
            onClick={() => update(saved.ids)}
            disabled={!dirty || pending}
          >
            <Undo2Icon aria-hidden className="size-3.5" /> Desfazer
          </button>
          <button
            type="button"
            className={primaryButton}
            onClick={save}
            disabled={!dirty || pending}
          >
            {pending ? (
              <Loader2Icon aria-hidden className="size-4 animate-spin" />
            ) : (
              <SaveIcon aria-hidden className="size-4" />
            )}
            Salvar destaques
          </button>
        </div>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            notice.tone === "ok" && "border-emerald-300 bg-emerald-50 text-emerald-900",
            notice.tone === "warn" && "border-amber-300 bg-amber-50 text-amber-900",
            notice.tone === "error" && "border-red-300 bg-red-50 text-red-900",
          )}
        >
          {notice.text}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-5">
          {SECTIONS.map((section) => (
            <section
              key={section.name}
              aria-labelledby={`sec-${section.positions[0]}`}
              className="flex flex-col gap-2"
            >
              <div className="flex items-baseline gap-2">
                <h2 id={`sec-${section.positions[0]}`} className="font-heading font-bold">
                  {section.name}
                </h2>
                <span className="text-xs text-muted-foreground">{section.hint}</span>
              </div>
              <ol className="flex flex-col gap-2">
                {section.positions.map((position) => {
                  const news = card(position);
                  return (
                    <li
                      key={position}
                      draggable={Boolean(news)}
                      onDragStart={() => (dragged.current = position)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const from = dragged.current;
                        dragged.current = null;
                        const id = from ? state.ids[from - 1] : null;
                        if (id && from !== position) put(state.cards[id], position);
                      }}
                      aria-label={`Posição ${position} (${sectionOf(position)})`}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border bg-background p-2 shadow-xs",
                        !news && "border-dashed bg-muted/40",
                      )}
                    >
                      <span className="w-6 shrink-0 text-center font-mono text-sm text-muted-foreground">
                        {position}
                      </span>
                      {news ? (
                        <>
                          <GripVerticalIcon
                            aria-hidden
                            className="size-4 shrink-0 cursor-grab text-muted-foreground"
                          />
                          <div className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
                            {news.imageUrl && (
                              <RemoteImage
                                src={news.imageUrl}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold">{news.title}</span>
                            <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                              {news.category} · <RelativeTime iso={news.publishedAt} />
                              {news.isSponsored && (
                                <span className="rounded bg-amber-100 px-1 font-semibold text-amber-900">
                                  Patrocinado
                                </span>
                              )}
                              {news.isUrgent && (
                                <span className="rounded bg-red-100 px-1 font-semibold text-red-800">
                                  Urgente
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              className={iconButton}
                              aria-label={`Subir “${news.title}”`}
                              disabled={position === 1}
                              onClick={() => update(move(state.ids, position, -1, isSponsored))}
                            >
                              <ArrowUpIcon aria-hidden className="size-4" />
                            </button>
                            <button
                              type="button"
                              className={iconButton}
                              aria-label={`Descer “${news.title}”`}
                              disabled={position === 10}
                              onClick={() => update(move(state.ids, position, 1, isSponsored))}
                            >
                              <ArrowDownIcon aria-hidden className="size-4" />
                            </button>
                            <button
                              type="button"
                              className={iconButton}
                              aria-label={`Tirar “${news.title}” do destaque`}
                              onClick={() => update(remove(state.ids, news.id, isSponsored))}
                            >
                              <XIcon aria-hidden className="size-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {position === 1
                            ? automatic && saved.ids[0] === null && state.ids[0] === null
                              ? `Manchete automática: ${automatic.title}`
                              : "Manchete automática: a notícia publicada mais recente"
                            : "Vazia"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-5">
          <section
            aria-labelledby="buscar"
            className="flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-xs"
          >
            <h2 id="buscar" className="font-heading font-bold">
              Notícias publicadas
            </h2>
            <label className="relative">
              <span className="sr-only">Buscar notícia publicada</span>
              <SearchIcon
                aria-hidden
                className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar pelo título"
                className="h-9 w-full rounded-md border bg-background pr-3 pl-8 text-sm outline-none focus-visible:border-brand-blue"
              />
            </label>
            {searching && <p className="text-xs text-muted-foreground">Buscando…</p>}
            <ul className="flex max-h-[28rem] flex-col divide-y overflow-y-auto">
              {results.map((news) => {
                const at = state.ids.indexOf(news.id);
                return (
                  <li key={news.id} className="flex flex-col gap-1.5 py-2">
                    <span className="text-sm font-semibold">{news.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {news.category} · <RelativeTime iso={news.publishedAt} />
                      {at >= 0 && ` · já na posição ${at + 1}`}
                      {news.isSponsored && " · Patrocinado"}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={button}
                        disabled={news.isSponsored}
                        title={news.isSponsored ? "Patrocinada não pode ser a manchete" : undefined}
                        onClick={() => put(news, 1)}
                      >
                        Manchete
                      </button>
                      <button type="button" className={button} onClick={() => put(news, 2)}>
                        Destaque
                      </button>
                      <button type="button" className={button} onClick={() => put(news, 4)}>
                        Faixa
                      </button>
                    </div>
                  </li>
                );
              })}
              {!searching && results.length === 0 && (
                <li className="py-2 text-sm text-muted-foreground">
                  Nenhuma notícia publicada encontrada.
                </li>
              )}
            </ul>
          </section>

          <section aria-labelledby="previa" className="flex flex-col gap-2">
            <h2 id="previa" className="font-heading font-bold">
              Prévia do topo
            </h2>
            <div className="flex flex-col gap-1.5 rounded-lg border bg-background p-2 text-xs shadow-xs">
              <div className="rounded bg-brand-blue p-3 font-heading text-sm font-bold text-white">
                {card(1)?.title ?? automatic?.title ?? "Manchete automática"}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[2, 3].map((p) => (
                  <div key={p} className="min-h-10 rounded bg-muted p-2 font-semibold">
                    {card(p)?.title ?? "—"}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[4, 5, 6, 7].map((p) => (
                  <div key={p} className="min-h-10 truncate rounded bg-muted/60 p-1.5">
                    {card(p)?.title ?? "últimas"}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
