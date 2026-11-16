"use client";

import { StarIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { featureNewsAction, type FeatureShortcut } from "@/app/admin/(painel)/noticias/actions";
import { cn } from "@/lib/utils";

const button =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-semibold transition hover:border-brand-blue hover:text-brand-blue disabled:pointer-events-none disabled:opacity-50";

/** Selo do destaque da home na listagem: "Manchete" ou "Destaque N". */
export function FeaturedBadge({ rank, className }: { rank?: number | null; className?: string }) {
  if (!rank) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-brand-blue px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white",
        className,
      )}
    >
      <StarIcon aria-hidden className="size-3 fill-current" />
      {rank === 1 ? "Manchete" : `Destaque ${rank}`}
    </span>
  );
}

/** Rótulos dos atalhos (iguais na listagem e no editor). */
export const shortcutLabels: Record<FeatureShortcut, string> = {
  MAIN: "Colocar como manchete",
  HIGHLIGHT: "Colocar nos destaques",
  NONE: "Tirar do destaque",
};

/** Quais atalhos cabem: patrocinada nunca vira manchete; quem já está no topo pode sair. */
export function availableShortcuts(rank: number | null | undefined, isSponsored: boolean) {
  const out: FeatureShortcut[] = [];
  if (rank !== 1 && !isSponsored) out.push("MAIN");
  if (!rank) out.push("HIGHLIGHT");
  if (rank) out.push("NONE");
  return out;
}

/**
 * Atalhos do editor de uma notícia publicada (spec 003, FR-007). A listagem usa os mesmos rótulos no
 * menu de cada notícia.
 */
export function FeatureShortcuts({
  newsId,
  isSponsored,
  initialRank,
}: {
  newsId: string;
  isSponsored: boolean;
  initialRank?: number | null;
}) {
  const [rank, setRank] = useState<number | null>(initialRank ?? null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function run(as: FeatureShortcut) {
    startTransition(async () => {
      const result = await featureNewsAction(newsId, as);
      if (!result.ok && result.message === "simulated") {
        setRank(as === "MAIN" ? 1 : as === "HIGHLIGHT" ? 2 : null);
        setMessage("Simulação — sem backend conectado.");
        return;
      }
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setRank(result.ranks[newsId] ?? null);
      setMessage(as === "NONE" ? "Saiu do destaque da home." : "A home já mostra a mudança.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        Destaque da home <FeaturedBadge rank={rank} />
        {!rank && <span className="font-normal text-muted-foreground">fora do destaque</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {availableShortcuts(rank, isSponsored).map((as) => (
          <button
            key={as}
            type="button"
            className={button}
            onClick={() => run(as)}
            disabled={pending}
          >
            {shortcutLabels[as]}
          </button>
        ))}
      </div>
      {isSponsored && (
        <p className="text-xs text-muted-foreground">
          Patrocinada pode ir para os destaques, nunca para a manchete.
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
