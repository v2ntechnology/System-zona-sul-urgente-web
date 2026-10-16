import type { CSSProperties } from "react";

import type { SectionColor } from "@/types/news";

type CategoryLike = {
  slug: string;
  color?: SectionColor;
  parent?: { slug: string; color?: SectionColor };
};

/** Paleta para escolher a cor de uma editoria (nome do token → nome para as pessoas). */
export const SECTION_COLORS: { key: SectionColor; label: string }[] = [
  { key: "seguranca", label: "Grafite" },
  { key: "transito", label: "Âmbar" },
  { key: "cidade", label: "Azul" },
  { key: "politica", label: "Roxo" },
  { key: "economia", label: "Verde" },
  { key: "esportes", label: "Petróleo" },
  { key: "entretenimento", label: "Magenta" },
  { key: "comunidade", label: "Laranja" },
  { key: "classificados", label: "Marrom" },
];
const PALETTE = new Set<string>(SECTION_COLORS.map((c) => c.key));

/**
 * Define `--section` com a cor da editoria (tokens --section-* em globals.css).
 * Usa a cor cadastrada; sem ela, a da mãe; sem nenhuma, o slug (editorias antigas) ou o
 * vermelho da marca. Uso: <div style={sectionStyle(category)} className="text-(--section)">.
 */
export function sectionStyle(category: CategoryLike | undefined): CSSProperties {
  const key =
    category?.color ?? category?.parent?.color ?? category?.parent?.slug ?? category?.slug;
  const color = key && PALETTE.has(key) ? `var(--section-${key})` : "var(--brand-red)";
  return { "--section": color } as CSSProperties;
}
