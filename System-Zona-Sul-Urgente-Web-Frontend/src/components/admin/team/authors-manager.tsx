"use client";

import { AlertCircleIcon, KeyRoundIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import { useState, useTransition } from "react";

import type { ListResult } from "@/app/admin/(painel)/editorias/actions";
import { saveAuthorAction, setAuthorActiveAction } from "@/app/admin/(painel)/equipe/actions";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { authorSlugFor } from "@/lib/team/validate";
import { cn } from "@/lib/utils";
import type { AuthorProfile } from "@/types/admin";

type Draft = { id?: string; name: string; role: string; bio: string; instagram: string };
const BIO_MAX = 160;
const ROLE_SUGGESTIONS = [
  "Repórter",
  "Colunista",
  "Colaborador",
  "Fotógrafo",
  "Agência",
  "Redação",
];

// Autores (FE-159): quem assina matérias. Os da equipe nascem junto com o convite; aqui
// entram também os sem login (colaborador, agência, "Redação"). Desativar tira do editor,
// mas o autor segue assinando as matérias antigas. Com a API, grava e mostra a lista
// devolvida (o site é avisado pela API); sem backend, é simulado.
export function AuthorsManager({ initial }: { initial: AuthorProfile[] }) {
  const [authors, setAuthors] = useState(initial);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  /** Grava na API e usa a lista devolvida; sem API ("simulated"), simula na tela. */
  function persist(
    call: () => Promise<ListResult<AuthorProfile>>,
    simulate: () => void,
    text: string,
    done?: () => void,
  ) {
    startTransition(async () => {
      const result = await call();
      if (result.ok) {
        setAuthors(result.list);
        setMessage({ tone: "ok", text });
        done?.();
      } else if (result.message === "simulated") {
        simulate();
        setMessage({ tone: "ok", text: `${text} (simulação — sem backend conectado).` });
        done?.();
      } else {
        if (result.errors) setErrors(result.errors);
        setMessage({ tone: "error", text: result.message });
      }
    });
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const found: typeof errors = {};
    if (editing.name.trim().length < 2)
      found.name = "Informe o nome como vai aparecer na assinatura.";
    if (!editing.role.trim()) found.role = "Informe o cargo (ex.: Colaborador).";
    if (editing.bio.length > BIO_MAX) found.bio = `No máximo ${BIO_MAX} caracteres.`;
    if (editing.instagram && !/^@?[\w.]{1,30}$/.test(editing.instagram.trim()))
      found.instagram = "Use só o usuário (ex.: @zonasulurgente).";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const fields = {
      name: editing.name.trim(),
      role: editing.role.trim(),
      bio: editing.bio.trim(),
      instagram: editing.instagram.trim().replace(/^@/, "") || undefined,
    };
    const draft = editing;
    const slug = authorSlugFor(
      fields.name,
      authors.map((a) => a.slug),
    );
    persist(
      () => saveAuthorAction({ ...draft, ...fields, instagram: fields.instagram ?? "" }),
      () =>
        draft.id
          ? setAuthors((list) => list.map((a) => (a.id === draft.id ? { ...a, ...fields } : a)))
          : setAuthors((list) => [
              { id: crypto.randomUUID(), slug, active: true, newsCount: 0, ...fields },
              ...list,
            ]),
      draft.id
        ? `“${fields.name}” atualizado`
        : `“${fields.name}” criado; já aparece no editor de notícias`,
      () => setEditing(null),
    );
  }

  function toggle(author: AuthorProfile) {
    persist(
      () => setAuthorActiveAction(author.id, !author.active),
      () =>
        setAuthors((list) =>
          list.map((a) => (a.id === author.id ? { ...a, active: !a.active } : a)),
        ),
      author.active
        ? `“${author.name}” saiu do editor; continua assinando as ${author.newsCount} matérias antigas`
        : `“${author.name}” voltou ao editor`,
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {authors.filter((a) => a.active).length} autores ativos ·{" "}
          {authors.filter((a) => !a.member).length} sem login
        </p>
        <button
          type="button"
          onClick={() => {
            setErrors({});
            setMessage(null);
            setEditing({ name: "", role: "Colaborador", bio: "", instagram: "" });
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          <PlusIcon aria-hidden className="size-4" /> Novo autor sem login
        </button>
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

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {authors.map((a) => {
          const initials = a.name
            .split(" ")
            .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
            .map((w) => w[0])
            .slice(0, 2)
            .join("");
          return (
            <li
              key={a.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-xs",
                !a.active && "opacity-60",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-blue font-heading text-sm font-bold text-white ring-2 ring-brand-red ring-offset-2 ring-offset-background"
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.role} · /autor/{a.slug}
                  </p>
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {a.bio || "Sem minibio."}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {a.member ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-sky-light px-2 py-0.5 font-semibold text-brand-blue">
                    <KeyRoundIcon aria-hidden className="size-3" /> Com login
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                    <UserRoundIcon aria-hidden className="size-3" /> Sem login
                  </span>
                )}
                {!a.active && (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                    Desativado
                  </span>
                )}
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {a.newsCount === 1 ? "1 matéria" : `${a.newsCount} matérias`}
                </span>
              </div>
              <div className="mt-auto flex gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setErrors({});
                    setMessage(null);
                    setEditing({
                      id: a.id,
                      name: a.name,
                      role: a.role,
                      bio: a.bio,
                      instagram: a.instagram ? `@${a.instagram}` : "",
                    });
                  }}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-sky-light"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => toggle(a)}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {a.active ? "Desativar" : "Reativar"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-5 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetTitle className="font-heading text-lg font-bold">
            {editing?.id ? "Editar autor" : "Novo autor sem login"}
          </SheetTitle>
          <SheetDescription>
            Como aparece na assinatura das matérias e na página do autor.
          </SheetDescription>
          {editing && (
            <form onSubmit={save} noValidate className="flex flex-col gap-4">
              <Field id="aut-name" label="Nome na assinatura" error={errors.name}>
                <input
                  id="aut-name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className={inputClass(errors.name)}
                  autoFocus
                />
              </Field>
              <Field id="aut-role" label="Cargo" error={errors.role}>
                <input
                  id="aut-role"
                  list="aut-role-sugestoes"
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  className={inputClass(errors.role)}
                />
                <datalist id="aut-role-sugestoes">
                  {ROLE_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field
                id="aut-bio"
                label={`Minibio (${editing.bio.length}/${BIO_MAX})`}
                error={errors.bio}
              >
                <textarea
                  id="aut-bio"
                  rows={3}
                  value={editing.bio}
                  onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                  placeholder="Ex.: Fotógrafo que cobre a orla desde 2015."
                  className={cn(inputClass(errors.bio), "h-auto py-2")}
                />
              </Field>
              <Field id="aut-ig" label="Instagram (opcional)" error={errors.instagram}>
                <input
                  id="aut-ig"
                  value={editing.instagram}
                  onChange={(e) => setEditing({ ...editing, instagram: e.target.value })}
                  placeholder="@usuario"
                  className={inputClass(errors.instagram)}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                O envio da foto do autor entra numa próxima etapa; até lá, aparecem as iniciais.
              </p>
              {message?.tone === "error" && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {message.text}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="h-10 rounded-full bg-brand-blue text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60"
              >
                {pending ? "Salvando…" : "Salvar"}
              </button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs font-medium text-destructive">
          <AlertCircleIcon aria-hidden className="size-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

function inputClass(error?: string) {
  return cn(
    "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
    error ? "border-destructive" : "border-input",
  );
}
