// Regras do topo da home no painel (spec 003) — espelho de HomeFeaturedService (API), para a tela e a prévia
// se comportarem igual à API. Posições 1..10: 1 = manchete, 2–3 ao lado, 4–7 faixa, 8–10 reserva.
// `null` = posição vazia (na 1, manchete automática: a publicada mais recente não patrocinada).

export const POSITIONS = 10;

export type Slots = (string | null)[];

export type Section = "Manchete" | "Destaques ao lado" | "Faixa" | "Reserva";

export function sectionOf(position: number): Section {
  if (position === 1) return "Manchete";
  if (position <= 3) return "Destaques ao lado";
  if (position <= 7) return "Faixa";
  return "Reserva";
}

/** Sempre 10 posições (corta o excesso, completa com vazias). */
export function normalize(slots: Slots): Slots {
  const out = slots.slice(0, POSITIONS);
  while (out.length < POSITIONS) out.push(null);
  return out;
}

/**
 * Tira a notícia e sobe as de baixo. Se a manchete sai e quem subiria para a 1 é patrocinada, a 1 fica vazia
 * (automática) e as demais ficam onde estão.
 */
export function remove(slots: Slots, id: string, isSponsored: (id: string) => boolean): Slots {
  const out = normalize(slots);
  const index = out.indexOf(id);
  if (index < 0) return out;
  if (index === 0 && out[1] !== null && isSponsored(out[1])) {
    out[0] = null;
    return out;
  }
  out.splice(index, 1);
  return normalize(out);
}

/**
 * Coloca a notícia na posição (1..10), deslocando as dali para baixo; a que passar da 10 sai. Já estando no topo,
 * sai do lugar antigo primeiro. Na 1 vazia, só ocupa (sem empurrar). Patrocinada na 1 → erro.
 */
export function place(
  slots: Slots,
  id: string,
  position: number,
  isSponsored: (id: string) => boolean,
): Slots {
  if (position === 1 && isSponsored(id)) {
    throw new Error("Notícia patrocinada não pode ser a manchete.");
  }
  const out = remove(slots, id, isSponsored);
  const index = Math.min(Math.max(position, 1), POSITIONS) - 1;
  if (out[index] === null && index === 0) {
    out[0] = id;
    return out;
  }
  out.splice(index, 0, id);
  return normalize(out);
}

/** Troca com a vizinha de cima (−1) ou de baixo (+1). Não deixa patrocinada subir para a manchete. */
export function move(
  slots: Slots,
  position: number,
  direction: -1 | 1,
  isSponsored: (id: string) => boolean,
): Slots {
  const out = normalize(slots);
  const from = position - 1;
  const to = from + direction;
  if (to < 0 || to >= POSITIONS) return out;
  const moving = out[from];
  const other = out[to];
  if (to === 0 && moving !== null && isSponsored(moving)) return out;
  if (from === 0 && other !== null && isSponsored(other)) return out;
  out[to] = moving;
  out[from] = other;
  return out;
}

/** Atalhos da listagem/editor (iguais à API). */
export function shortcut(
  slots: Slots,
  id: string,
  as: "MAIN" | "HIGHLIGHT" | "NONE",
  isSponsored: (id: string) => boolean,
): Slots {
  if (as === "NONE") return remove(slots, id, isSponsored);
  return place(slots, id, as === "MAIN" ? 1 : 2, isSponsored);
}

/** Notícia que a regra tirou do topo (passou da 10ª posição) ao colocar `id`. */
export function droppedBy(before: Slots, after: Slots): string[] {
  const kept = new Set(after.filter((s): s is string => s !== null));
  return before.filter((s): s is string => s !== null && !kept.has(s));
}
