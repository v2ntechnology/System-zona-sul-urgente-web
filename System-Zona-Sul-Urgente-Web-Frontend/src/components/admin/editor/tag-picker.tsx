"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { cleanTagName, matchTags, newTagError, TAG_LIMITS, tagKey } from "@/lib/editor/tags";
import { cn } from "@/lib/utils";

type TagOption = { slug: string; name: string };

type TagPickerProps = {
  options: TagOption[];
  selected: string[];
  newTags: string[];
  canCreate: boolean;
  error?: string;
  onChange: (selected: string[], newTags: string[]) => void;
};

const chip = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs";

// Tópicos da matéria: busca nos existentes e, para quem tem `tags.manage`, cria novos.
// Antes de criar, mostra os parecidos ("Tiroteios" acha "Tiroteio") para evitar duplicados.
export function TagPicker({
  options,
  selected,
  newTags,
  canCreate,
  error,
  onChange,
}: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const listId = useId();

  const full = selected.length + newTags.length >= TAG_LIMITS.perNews;
  const { matches, existing } = matchTags(query, options, selected);
  const name = cleanTagName(query);
  const duplicateNew = newTags.some((t) => tagKey(t) === tagKey(name));
  const canOffer = canCreate && name && !existing && !duplicateNew && !newTagError(name);
  const suggestions = query
    ? matches
    : options.filter((t) => !selected.includes(t.slug)).slice(0, 8);

  function add(slug: string) {
    if (full) return;
    onChange([...selected, slug], newTags);
    setQuery("");
    setHint(null);
  }

  function create() {
    const problem = newTagError(name);
    if (problem) return setHint(problem);
    if (existing) return add(existing.slug);
    if (duplicateNew || full) return;
    onChange(selected, [...newTags, name]);
    setQuery("");
    setHint(null);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!name) return;
      if (existing && !selected.includes(existing.slug)) add(existing.slug);
      else if (matches[0]) add(matches[0].slug);
      else if (canCreate) create();
      else setHint("Tópico não encontrado. Peça a um editor para criá-lo.");
    } else if (event.key === "Backspace" && !query) {
      if (newTags.length) onChange(selected, newTags.slice(0, -1));
      else if (selected.length) onChange(selected.slice(0, -1), newTags);
    }
  }

  const nameOf = (slug: string) => options.find((t) => t.slug === slug)?.name ?? slug;

  return (
    <div className="flex flex-col gap-2">
      {(selected.length > 0 || newTags.length > 0) && (
        <ul aria-label="Tópicos escolhidos" className="flex flex-wrap gap-1.5">
          {selected.map((slug) => (
            <li key={slug} className={cn(chip, "border-brand-blue bg-brand-blue text-white")}>
              {nameOf(slug)}
              <RemoveButton
                label={nameOf(slug)}
                onClick={() =>
                  onChange(
                    selected.filter((s) => s !== slug),
                    newTags,
                  )
                }
              />
            </li>
          ))}
          {newTags.map((tag) => (
            <li key={tag} className={cn(chip, "border-dashed border-brand-blue text-brand-blue")}>
              {tag}
              <span className="text-[0.65rem] font-semibold uppercase">novo</span>
              <RemoveButton
                label={tag}
                onClick={() =>
                  onChange(
                    selected,
                    newTags.filter((t) => t !== tag),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}

      <input
        id="campo-newTags"
        type="text"
        value={query}
        disabled={full}
        onChange={(e) => {
          setQuery(e.target.value);
          setHint(null);
        }}
        onKeyDown={onKeyDown}
        maxLength={TAG_LIMITS.name.max + 10}
        placeholder={
          full
            ? `Limite de ${TAG_LIMITS.perNews} tópicos`
            : canCreate
              ? "Buscar ou criar tópico"
              : "Buscar tópico"
        }
        aria-describedby={`${listId}-ajuda`}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60",
          error && "border-destructive",
        )}
      />

      {!full && (suggestions.length > 0 || canOffer || (query && !canCreate)) && (
        <div className="flex flex-col gap-1.5">
          {query && (
            <p className="text-xs text-muted-foreground">
              {suggestions.length > 0 ? "Tópicos parecidos:" : "Nenhum tópico parecido."}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => add(t.slug)}
                className={cn(chip, "hover:border-brand-blue hover:text-brand-blue")}
              >
                {t.name}
              </button>
            ))}
            {canOffer && (
              <button
                type="button"
                onClick={create}
                className={cn(
                  chip,
                  "border-dashed border-brand-blue font-semibold text-brand-blue hover:bg-accent",
                )}
              >
                <PlusIcon aria-hidden className="size-3.5" />
                Criar tópico “{name}”
              </button>
            )}
          </div>
        </div>
      )}

      <p id={`${listId}-ajuda`} aria-live="polite" className="text-xs text-muted-foreground">
        {hint ??
          error ??
          (canCreate
            ? "Enter escolhe o primeiro parecido ou cria um novo. Tópicos novos são criados ao salvar."
            : "Só editores e repórteres criam tópicos novos.")}
      </p>
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remover ${label}`}
      className="-mr-1 rounded-full p-0.5 hover:bg-current/15"
    >
      <XIcon aria-hidden className="size-3" />
    </button>
  );
}
