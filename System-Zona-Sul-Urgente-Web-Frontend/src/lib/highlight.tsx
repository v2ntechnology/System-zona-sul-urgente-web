import { Fragment } from "react";

const VARIANTS: Record<string, string> = {
  a: "aáàâãä",
  e: "eéèêë",
  i: "iíìîï",
  o: "oóòôõö",
  u: "uúùûü",
  c: "cç",
};

/** Regex que acha o termo ignorando acentos e maiúsculas ("reboucas" acha "Rebouças"). */
export function accentInsensitivePattern(term: string): string {
  const base = term.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return [...base]
    .map((ch) => (VARIANTS[ch] ? `[${VARIANTS[ch]}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
}

/** Envolve os termos buscados em <mark>. Seguro: só cria nós de texto, sem HTML. */
export function highlight(text: string, query: string): React.ReactNode {
  const terms = query.split(/\s+/).filter((t) => t.length >= 2);
  if (terms.length === 0) return text;
  const regex = new RegExp(`(${terms.map(accentInsensitivePattern).join("|")})`, "gi");
  return text.split(regex).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-brand-sky-light text-inherit">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
