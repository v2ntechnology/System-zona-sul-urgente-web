"use client";

import { AlertCircleIcon, CopyIcon, HashIcon, MergeIcon, SearchIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  type ListResult,
  mergeTagsAction,
  renameTagAction,
  setTagActiveAction,
} from "@/app/admin/(painel)/editorias/actions";
import { RelativeTime } from "@/components/news/relative-time";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { duplicateGroups, renameTagError } from "@/lib/taxonomy/validate";
import { cn } from "@/lib/utils";

export type ManagedTag = {
  id: string;
  slug: string;
  name: string;
  newsCount: number;
  lastUsedAt?: string;
  active: boolean;
};

const normalize = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Tópicos (FE-158): buscar, renomear, desativar e juntar duplicados. Juntar move as
// matérias para o tópico que fica e apaga os outros. Com a API, grava e mostra a lista
// devolvida; sem backend, simula na tela.
export function TagsManager({ initial, canCreate }: { initial: ManagedTag[]; canCreate: boolean }) {
  const [tags, setTags] = useState(initial);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState<ManagedTag[] | null>(null);
  const [keep, setKeep] = useState<string>("");
  const [renaming, setRenaming] = useState<{ id: string; name: string; error?: string } | null>(
    null,
  );
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  /** Grava na API e usa a lista devolvida; sem API, simula. */
  function persist(
    call: () => Promise<ListResult<ManagedTag>>,
    simulate: () => void,
    text: string,
    onError?: (result: { message: string; errors?: Record<string, string> }) => void,
  ) {
    startTransition(async () => {
      const result = await call();
      if (result.ok) {
        setTags(result.list);
        setMessage({ tone: "ok", text });
      } else if (result.message === "simulated") {
        simulate();
        setMessage({ tone: "ok", text: `${text} (simulação — sem backend conectado).` });
      } else if (onError) {
        onError(result);
      } else {
        setMessage({ tone: "error", text: result.message });
      }
    });
  }
  const groups = useMemo(() => duplicateGroups(tags.filter((t) => t.active)), [tags]);
  const visible = tags.filter(
    (t) =>
      !query || normalize(t.name).includes(normalize(query)) || t.slug.includes(normalize(query)),
  );

  function startMerge(list: ManagedTag[]) {
    // Sugere manter o mais usado.
    const sorted = [...list].sort((a, b) => b.newsCount - a.newsCount);
    setKeep(sorted[0].id);
    setMerging(sorted);
  }

  function confirmMerge() {
    if (!merging) return;
    const target = merging.find((t) => t.id === keep)!;
    const others = merging.filter((t) => t.id !== keep);
    const total = merging.reduce((s, t) => s + t.newsCount, 0);
    setSelected([]);
    setMerging(null);
    persist(
      () =>
        mergeTagsAction(
          target.id,
          others.map((o) => o.id),
        ),
      () =>
        setTags((list) =>
          list
            .filter((t) => !others.some((o) => o.id === t.id))
            .map((t) => (t.id === target.id ? { ...t, newsCount: total } : t)),
        ),
      `${others.map((o) => `“${o.name}”`).join(", ")} juntado em “${target.name}”`,
    );
  }

  function saveRename() {
    if (!renaming) return;
    const error = renameTagError(renaming.name, renaming.id, tags);
    if (error) return setRenaming({ ...renaming, error });
    const before = tags.find((t) => t.id === renaming.id)!;
    const current = renaming;
    persist(
      () => renameTagAction(current.id, current.name.trim()),
      () =>
        setTags((list) =>
          list.map((t) => (t.id === current.id ? { ...t, name: current.name.trim() } : t)),
        ),
      `“${before.name}” agora é “${current.name.trim()}”`,
      // Erro do nome fica no próprio campo (a edição continua aberta).
      (result) => setRenaming({ ...current, error: result.errors?.name ?? result.message }),
    );
    setRenaming(null);
  }

  function toggleActive(tag: ManagedTag) {
    persist(
      () => setTagActiveAction(tag.id, !tag.active),
      () => setTags((list) => list.map((t) => (t.id === tag.id ? { ...t, active: !t.active } : t))),
      tag.active
        ? `“${tag.name}” desativado: some do editor, as matérias continuam com ele`
        : `“${tag.name}” reativado`,
    );
  }

  const toggleSelected = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col gap-5">
      {groups.length > 0 && (
        <section
          aria-labelledby="duplicados"
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          <h2
            id="duplicados"
            className="flex items-center gap-2 text-sm font-semibold text-amber-900"
          >
            <CopyIcon aria-hidden className="size-4" /> Possíveis duplicados
          </h2>
          <ul className="flex flex-col gap-2">
            {groups.map((group) => (
              <li
                key={group.map((t) => t.id).join("-")}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                {group.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full bg-background px-2.5 py-0.5 ring-1 ring-amber-300"
                  >
                    #{t.name} <span className="text-xs text-muted-foreground">({t.newsCount})</span>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => startMerge(group)}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-900 px-3 text-xs font-semibold text-white"
                >
                  <MergeIcon aria-hidden className="size-3.5" /> Juntar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="tag-busca" className="sr-only">
            Buscar tópico
          </label>
          <SearchIcon
            aria-hidden
            className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="tag-busca"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tópico"
            className="h-10 w-full rounded-full border bg-background pr-4 pl-10 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {tags.length} tópicos{canCreate && " · novos são criados direto no editor de notícias"}
        </p>
        {selected.length >= 2 && (
          <button
            type="button"
            onClick={() => startMerge(tags.filter((t) => selected.includes(t.id)))}
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-dark"
          >
            <MergeIcon aria-hidden className="size-4" /> Juntar {selected.length} tópicos
          </button>
        )}
      </div>
      <p
        aria-live="polite"
        className={
          !message
            ? "sr-only"
            : message.tone === "ok"
              ? "rounded-md bg-brand-sky-light px-3 py-2 text-sm text-brand-blue"
              : "rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        }
      >
        {message?.text}
      </p>

      <div className="overflow-x-auto rounded-xl border bg-background shadow-xs">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="w-10 px-4 py-2.5">
                <span className="sr-only">Selecionar</span>
              </th>
              <th scope="col" className="px-2 py-2.5 font-semibold">
                Tópico
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Matérias
              </th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold sm:table-cell">
                Último uso
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((tag) => {
              const editing = renaming?.id === tag.id;
              const duplicated = groups.some((g) => g.some((t) => t.id === tag.id));
              return (
                <tr key={tag.id} className={cn(!tag.active && "opacity-60")}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(tag.id)}
                      onChange={() => toggleSelected(tag.id)}
                      aria-label={`Selecionar ${tag.name}`}
                      className="size-4 accent-brand-blue"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    {editing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveRename();
                        }}
                        className="flex flex-col gap-1"
                      >
                        <div className="flex gap-2">
                          <label htmlFor={`rename-${tag.id}`} className="sr-only">
                            Novo nome de {tag.name}
                          </label>
                          <input
                            id={`rename-${tag.id}`}
                            value={renaming.name}
                            onChange={(e) =>
                              setRenaming({ ...renaming, name: e.target.value, error: undefined })
                            }
                            onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                            autoFocus
                            className={cn(
                              "h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm",
                              renaming.error ? "border-destructive" : "border-input",
                            )}
                          />
                          <button
                            type="submit"
                            className="rounded-md bg-brand-blue px-3 text-xs font-semibold text-white"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenaming(null)}
                            className="rounded-md px-2 text-xs font-semibold text-muted-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                        {renaming.error && (
                          <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                            <AlertCircleIcon aria-hidden className="size-3.5" /> {renaming.error}
                          </p>
                        )}
                      </form>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <HashIcon aria-hidden className="size-3.5 text-brand-red" />
                        <span className="font-medium">{tag.name}</span>
                        {duplicated && (
                          <span className="rounded-full bg-amber-50 px-1.5 text-[0.65rem] font-semibold text-amber-800">
                            duplicado?
                          </span>
                        )}
                        {!tag.active && (
                          <span className="rounded-full bg-muted px-1.5 text-[0.65rem] font-semibold text-muted-foreground">
                            desativado
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{tag.newsCount}</td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
                    {tag.lastUsedAt ? <RelativeTime iso={tag.lastUsedAt} /> : "nunca"}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {!editing && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRenaming({ id: tag.id, name: tag.name })}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-sky-light"
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(tag)}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {tag.active ? "Desativar" : "Reativar"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum tópico encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={merging !== null} onOpenChange={(o) => !o && setMerging(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Juntar tópicos</AlertDialogTitle>
            <AlertDialogDescription>
              As matérias de todos passam para o tópico escolhido, e os outros deixam de existir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Qual nome fica?</legend>
            {merging?.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="keep"
                  value={t.id}
                  checked={keep === t.id}
                  onChange={() => setKeep(t.id)}
                  className="size-4 accent-brand-blue"
                />
                #{t.name}
                <span className="text-xs text-muted-foreground">({t.newsCount} matérias)</span>
              </label>
            ))}
          </fieldset>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMerge}>Juntar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
