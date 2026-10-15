import type { CSSProperties } from "react";

type CategoryLike = { slug: string; parent?: { slug: string } };

const SECTION_SLUGS = new Set([
  "seguranca",
  "transito",
  "cidade",
  "politica",
  "economia",
  "esportes",
  "entretenimento",
  "comunidade",
  "classificados",
]);

/**
 * Define `--section` com a cor da editoria (tokens --section-* em globals.css).
 * Subeditoria herda a cor da mãe. Editoria sem cor cadastrada usa o vermelho da marca.
 * Uso: <div style={sectionStyle(category)} className="text-(--section)">.
 */
export function sectionStyle(category: CategoryLike | undefined): CSSProperties {
  const slug = category?.parent?.slug ?? category?.slug;
  const color = slug && SECTION_SLUGS.has(slug) ? `var(--section-${slug})` : "var(--brand-red)";
  return { "--section": color } as CSSProperties;
}
