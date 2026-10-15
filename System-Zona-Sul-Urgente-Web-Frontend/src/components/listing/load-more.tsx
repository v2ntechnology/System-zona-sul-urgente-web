"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";

import { NewsCard } from "@/components/news/news-card";
import type { NewsSummary } from "@/types/news";

type LoadMoreProps = {
  /** Filtro da listagem: editoria ou bairro. */
  filter: { editoria: string } | { bairro: string };
  initialCursor: string | null;
};

// "Carregar mais notícias" (FE-104/FE-105). A primeira página vem do servidor (estática,
// boa para SEO); as seguintes, de /api/news. O sitemap garante que o Google ache todas.
export function LoadMore({ filter, initialCursor }: LoadMoreProps) {
  const [items, setItems] = useState<NewsSummary[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  if (!initialCursor) return null;

  async function load() {
    if (!cursor) return;
    setStatus("loading");
    try {
      const params = new URLSearchParams({ ...filter, cursor });
      const response = await fetch(`/api/news?${params}`);
      if (!response.ok) throw new Error(String(response.status));
      const data: { items: NewsSummary[]; nextCursor: string | null } = await response.json();
      setItems((current) => [...current, ...data.items]);
      setCursor(data.nextCursor);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {items.length > 0 && (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((news) => (
            <NewsCard key={news.id} news={news} />
          ))}
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {items.length > 0 && `${items.length} notícias carregadas.`}
      </p>
      <div className="flex flex-col items-center gap-2 border-t pt-6">
        {cursor ? (
          <button
            type="button"
            onClick={load}
            disabled={status === "loading"}
            className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-brand-blue px-6 text-sm font-bold text-brand-blue transition hover:bg-brand-blue hover:text-white disabled:opacity-60"
          >
            {status === "loading" && (
              <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
            )}
            {status === "loading" ? "Carregando…" : "Carregar mais notícias"}
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">Você chegou ao fim das notícias.</p>
        )}
        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar agora. Tente de novo.
          </p>
        )}
      </div>
    </div>
  );
}
