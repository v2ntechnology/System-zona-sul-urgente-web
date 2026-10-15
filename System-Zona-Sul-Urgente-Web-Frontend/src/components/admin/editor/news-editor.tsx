"use client";

import {
  AlertCircleIcon,
  CameraIcon,
  CheckCircle2Icon,
  EyeIcon,
  LoaderCircleIcon,
  PencilIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { saveNewsAction } from "@/app/admin/noticias/actions";
import { RichTextEditor } from "@/components/admin/editor/rich-text-editor";
import { TagPicker } from "@/components/admin/editor/tag-picker";
import { StatusBadge } from "@/components/admin/status-badge";
import { adminRoutes } from "@/config/admin-navigation";
import { countWords } from "@/lib/editor/blocks";
import { draftWarnings, LIMITS, validateDraft } from "@/lib/editor/validate";
import { cn } from "@/lib/utils";
import type { DraftErrors, NewsDraft, SaveIntent } from "@/types/admin";
import type { ArticleBlock } from "@/types/news";

type Option = { slug: string; name: string };

export type EditorOptions = {
  categories: (Option & { parentName?: string })[];
  authors: Option[];
  neighborhoods: Option[];
  tags: Option[];
};

export type EditorPermissions = {
  canPublish: boolean;
  canMarkUrgent: boolean;
  canMarkSponsored: boolean;
  canCreateTags: boolean;
};

type NewsEditorProps = {
  initial: NewsDraft;
  options: EditorOptions;
  permissions: EditorPermissions;
};

type LocalBackup = { savedAt: string; draft: NewsDraft };

const noopSubscribe = () => () => {};

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Armazenamento indisponível (aba anônima, bloqueio): segue sem cópia local.
    return null;
  }
}

const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const AUTOSAVE_MS = 1500;

// Editor de notícia (FE-154). Proteções contra perda: cópia local automática (localStorage),
// aviso ao sair com alterações e oferta de recuperar a cópia ao reabrir.
export function NewsEditor({ initial, options, permissions }: NewsEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [backupHandled, setBackupHandled] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);

  const storageKey = `zsu-editor:${initial.id ?? "nova"}`;
  const warnings = useMemo(() => draftWarnings(draft), [draft]);
  const words = useMemo(() => countWords(draft.body), [draft.body]);

  // Ao abrir: oferece recuperar a cópia local, se for mais nova que a versão salva.
  // Lida via useSyncExternalStore (no servidor não há localStorage: sem divergência de HTML).
  const rawBackup = useSyncExternalStore(
    noopSubscribe,
    () => readStorage(storageKey),
    () => null,
  );
  const backup = useMemo<LocalBackup | null>(() => {
    if (!rawBackup) return null;
    try {
      const parsed = JSON.parse(rawBackup) as LocalBackup;
      return !initial.updatedAt || parsed.savedAt > initial.updatedAt ? parsed : null;
    } catch {
      return null;
    }
  }, [rawBackup, initial.updatedAt]);
  // Só oferece ao abrir: depois que o usuário edita, a cópia é dele mesmo.
  const showBackup = Boolean(backup) && !backupHandled && !dirty;

  // Cópia local automática enquanto houver alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ savedAt: new Date().toISOString(), draft }),
        );
      } catch {
        // Sem armazenamento: só o aviso ao sair protege.
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, dirty, storageKey]);

  // Aviso do navegador ao fechar/recarregar com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function update<K extends keyof NewsDraft>(key: K, value: NewsDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    // Campos compostos (image.url, image.alt) também limpam o erro ao serem editados.
    setErrors((current) => {
      const related = Object.keys(current).filter(
        (field) => field === key || field.startsWith(`${String(key)}.`),
      );
      if (related.length === 0) return current;
      const next = { ...current };
      for (const field of related) delete next[field as keyof DraftErrors];
      return next;
    });
  }

  // O editor rico também chama no carregamento: não marca "alterado" na primeira vez.
  const bodyLoaded = useRef(false);
  function onBodyChange(blocks: ArticleBlock[]) {
    setDraft((current) => ({ ...current, body: blocks }));
    if (bodyLoaded.current) setDirty(true);
    bodyLoaded.current = true;
    if (errors.body) setErrors((current) => ({ ...current, body: undefined }));
  }

  function restoreBackup() {
    if (!backup) return;
    // Cópias antigas podem não ter campos novos do rascunho.
    setDraft({ ...initial, ...backup.draft });
    setDirty(true);
    setBackupHandled(true);
    bodyLoaded.current = false;
    setEditorKey((k) => k + 1); // remonta o editor rico com o texto recuperado
  }

  function discardBackup() {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setBackupHandled(true);
  }

  function save(intent: SaveIntent) {
    const clientErrors = validateDraft(draft, intent);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      setMessage({ tone: "error", text: "Revise os campos destacados." });
      setTab("edit");
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    startTransition(async () => {
      const result = await saveNewsAction(draft, intent);
      if (!result.ok) {
        setErrors(result.errors);
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setDraft((current) => ({ ...current, id: result.id, status: result.status }));
      setDirty(false);
      setSavedAt(result.savedAt);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      const what: Record<SaveIntent, string> = {
        draft: "Rascunho salvo",
        review: "Enviada para revisão",
        publish: "Publicada",
        schedule: "Agendada",
      };
      setMessage({
        tone: "ok",
        text: `${what[intent]} às ${time.format(new Date(result.savedAt))}${result.simulated ? " (simulação — sem backend conectado)" : ""}.`,
      });
    });
  }

  const errorList = Object.entries(errors).filter(([, value]) => value);

  return (
    <div className="flex flex-col gap-4">
      {/* Topo: título da tela, status, estado de salvamento e abas. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold">
            {initial.id ? "Editar notícia" : "Nova notícia"}
          </h1>
          <StatusBadge status={draft.status} />
          {draft.origin === "INSTAGRAM" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue">
              <CameraIcon aria-hidden className="size-3.5" /> Importada do Instagram
            </span>
          )}
        </div>
        <SaveState pending={pending} dirty={dirty} savedAt={savedAt} />
      </div>

      {showBackup && backup && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>
            Há uma versão não salva desta notícia de {time.format(new Date(backup.savedAt))}. Quer
            recuperar?
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={restoreBackup}
              className="rounded-md bg-amber-900 px-3 py-1.5 font-semibold text-white"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={discardBackup}
              className="rounded-md px-3 py-1.5 font-semibold hover:underline"
            >
              Descartar
            </button>
          </span>
        </div>
      )}

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2.5 text-sm",
            message.tone === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900",
          )}
        >
          {message.tone === "ok" ? (
            <CheckCircle2Icon aria-hidden className="size-4" />
          ) : (
            <AlertCircleIcon aria-hidden className="size-4" />
          )}
          {message.text}
        </p>
      )}

      {errorList.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          className="rounded-md border border-destructive/40 bg-background p-4 text-sm outline-none"
        >
          <p className="font-semibold text-destructive">Antes de continuar, corrija:</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map(([field, text]) => (
              <li key={field}>
                <a href={`#campo-${field.replace(".", "-")}`} className="underline">
                  {text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div role="tablist" aria-label="Modo do editor" className="flex gap-1 border-b">
        {(
          [
            ["edit", "Editar", PencilIcon],
            ["preview", "Pré-visualizar", EyeIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground aria-selected:border-brand-red aria-selected:text-foreground"
          >
            <Icon aria-hidden className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Coluna principal */}
        <div className={tab === "edit" ? "flex flex-col gap-5" : "hidden"}>
          <Field
            id="title"
            label="Título"
            error={errors.title}
            counter={[draft.title.length, LIMITS.title.max]}
          >
            {/* Cresce com o texto (títulos longos aparecem inteiros); Enter não quebra linha. */}
            <textarea
              id="campo-title"
              rows={1}
              value={draft.title}
              onChange={(e) => update("title", e.target.value.replace(/\n/g, " "))}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              maxLength={LIMITS.title.max + 20}
              placeholder="Ex.: Temporal alaga ruas de Copacabana e Botafogo"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "erro-title" : undefined}
              className={inputClass(
                errors.title,
                "field-sizing-content resize-none font-heading text-headline font-bold",
              )}
            />
          </Field>
          <Field
            id="subtitle"
            label="Subtítulo (linha fina)"
            error={errors.subtitle}
            counter={[draft.subtitle.length, LIMITS.subtitle.max]}
            optional
          >
            <input
              id="campo-subtitle"
              value={draft.subtitle}
              onChange={(e) => update("subtitle", e.target.value)}
              className={inputClass(errors.subtitle)}
            />
          </Field>
          <Field
            id="summary"
            label="Resumo"
            hint="Aparece nos cards, no compartilhamento e no Google."
            error={errors.summary}
            counter={[draft.summary.length, LIMITS.summary.max]}
          >
            <textarea
              id="campo-summary"
              value={draft.summary}
              onChange={(e) => update("summary", e.target.value)}
              rows={3}
              aria-invalid={Boolean(errors.summary)}
              className={inputClass(errors.summary)}
            />
          </Field>
          <div id="campo-body" className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">Texto</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {words} palavras · {Math.max(1, Math.round(words / 200))} min de leitura
              </span>
            </div>
            <RichTextEditor
              key={editorKey}
              initialBlocks={draft.body}
              onChange={onBodyChange}
              invalid={Boolean(errors.body)}
              describedBy={errors.body ? "erro-body" : undefined}
            />
            {errors.body && <FieldError id="erro-body">{errors.body}</FieldError>}
          </div>
          {draft.instagramCaption && (
            <details className="rounded-md border bg-background p-4 text-sm">
              <summary className="cursor-pointer font-semibold">
                Legenda original do Instagram (somente leitura)
              </summary>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">
                {draft.instagramCaption}
              </p>
            </details>
          )}
        </div>

        {tab === "preview" && <Preview draft={draft} options={options} />}

        {/* Coluna lateral */}
        <aside className="flex flex-col gap-4">
          <Card title="Publicação">
            {draft.status !== "PUBLISHED" && permissions.canPublish && (
              <Field id="scheduledFor" label="Agendar para" optional error={errors.scheduledFor}>
                <input
                  id="campo-scheduledFor"
                  type="datetime-local"
                  value={draft.scheduledFor}
                  onChange={(e) => update("scheduledFor", e.target.value)}
                  className={inputClass(errors.scheduledFor)}
                />
              </Field>
            )}
            <div className="flex flex-col gap-2">
              <ActionButton onClick={() => save("draft")} disabled={pending} variant="outline">
                Salvar rascunho
              </ActionButton>
              {permissions.canPublish ? (
                <>
                  {draft.scheduledFor && draft.status !== "PUBLISHED" ? (
                    <ActionButton onClick={() => save("schedule")} disabled={pending}>
                      Agendar publicação
                    </ActionButton>
                  ) : (
                    <ActionButton onClick={() => save("publish")} disabled={pending}>
                      {draft.status === "PUBLISHED" ? "Atualizar publicação" : "Publicar agora"}
                    </ActionButton>
                  )}
                </>
              ) : (
                <ActionButton onClick={() => save("review")} disabled={pending}>
                  Enviar para revisão
                </ActionButton>
              )}
              <button
                type="button"
                onClick={() => setTab(tab === "preview" ? "edit" : "preview")}
                className="text-sm font-semibold text-brand-blue hover:underline"
              >
                {tab === "preview" ? "Voltar a editar" : "Pré-visualizar"}
              </button>
            </div>
          </Card>

          <Card title="Classificação">
            <Field id="categorySlug" label="Editoria" error={errors.categorySlug}>
              <select
                id="campo-categorySlug"
                value={draft.categorySlug}
                onChange={(e) => update("categorySlug", e.target.value)}
                aria-invalid={Boolean(errors.categorySlug)}
                className={inputClass(errors.categorySlug)}
              >
                <option value="">Escolha…</option>
                {options.categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="neighborhoodSlug" label="Bairro" optional>
              <select
                id="campo-neighborhoodSlug"
                value={draft.neighborhoodSlug}
                onChange={(e) => update("neighborhoodSlug", e.target.value)}
                className={inputClass()}
              >
                <option value="">Sem bairro específico</option>
                {options.neighborhoods.map((n) => (
                  <option key={n.slug} value={n.slug}>
                    {n.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset id="campo-authorSlugs" className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-semibold">Autores</legend>
              {options.authors.map((a) => (
                <label key={a.slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.authorSlugs.includes(a.slug)}
                    onChange={(e) =>
                      update(
                        "authorSlugs",
                        e.target.checked
                          ? [...draft.authorSlugs, a.slug]
                          : draft.authorSlugs.filter((s) => s !== a.slug),
                      )
                    }
                    className="size-4 accent-brand-blue"
                  />
                  {a.name}
                </label>
              ))}
              {errors.authorSlugs && (
                <FieldError id="erro-authorSlugs">{errors.authorSlugs}</FieldError>
              )}
            </fieldset>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-semibold">Tópicos</legend>
              <TagPicker
                options={options.tags}
                selected={draft.tagSlugs}
                newTags={draft.newTags}
                canCreate={permissions.canCreateTags}
                error={errors.newTags}
                onChange={(tagSlugs, newTags) => {
                  update("tagSlugs", tagSlugs);
                  update("newTags", newTags);
                }}
              />
            </fieldset>
          </Card>

          <Card title="Foto principal">
            <Field
              id="image-url"
              label="Endereço da imagem"
              hint="Upload direto entra com o armazenamento de mídia (BE-012)."
              error={errors["image.url"]}
            >
              <input
                id="campo-image-url"
                type="url"
                value={draft.image.url}
                onChange={(e) => update("image", { ...draft.image, url: e.target.value })}
                placeholder="https://"
                className={inputClass(errors["image.url"])}
              />
            </Field>
            {draft.image.url && /^https?:\/\//.test(draft.image.url) && (
              // Prévia simples (sem otimização): o endereço ainda não foi validado pelo servidor.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.image.url}
                alt=""
                className="aspect-video w-full rounded-md bg-muted object-cover"
              />
            )}
            <Field
              id="image-alt"
              label="Texto alternativo"
              hint="Descreva a foto para quem não a vê."
              error={errors["image.alt"]}
            >
              <input
                id="campo-image-alt"
                value={draft.image.alt}
                onChange={(e) => update("image", { ...draft.image, alt: e.target.value })}
                className={inputClass(errors["image.alt"])}
              />
            </Field>
            <Field id="image-caption" label="Legenda" optional>
              <input
                id="campo-image-caption"
                value={draft.image.caption}
                onChange={(e) => update("image", { ...draft.image, caption: e.target.value })}
                className={inputClass()}
              />
            </Field>
            <Field id="image-credit" label="Crédito" optional>
              <input
                id="campo-image-credit"
                value={draft.image.credit}
                onChange={(e) => update("image", { ...draft.image, credit: e.target.value })}
                placeholder="Foto: Fulano/Zona Sul Urgente"
                className={inputClass()}
              />
            </Field>
          </Card>

          <Card title="Marcadores">
            <Toggle
              label="Urgente"
              description="Selo vermelho e faixa de urgentes no topo do site."
              checked={draft.isUrgent}
              disabled={!permissions.canMarkUrgent}
              onChange={(v) => update("isUrgent", v)}
            />
            <Toggle
              label="Matéria patrocinada"
              description="Selo “Patrocinado” obrigatório em todo o site; fica fora dos feeds e das Mais Lidas."
              checked={draft.isSponsored}
              disabled={!permissions.canMarkSponsored}
              onChange={(v) => update("isSponsored", v)}
            />
            {draft.isSponsored && (
              <Field id="sponsorName" label="Patrocinador" error={errors.sponsorName}>
                <input
                  id="campo-sponsorName"
                  value={draft.sponsorName}
                  onChange={(e) => update("sponsorName", e.target.value)}
                  className={inputClass(errors.sponsorName)}
                />
              </Field>
            )}
          </Card>

          <Card title="SEO (Google)">
            <Field
              id="seo-title"
              label="Título para o Google"
              optional
              counter={[(draft.seo.title || draft.title).length, LIMITS.seoTitle.max]}
            >
              <input
                id="campo-seo-title"
                value={draft.seo.title}
                onChange={(e) => update("seo", { ...draft.seo, title: e.target.value })}
                placeholder={draft.title || "Usa o título da matéria"}
                className={inputClass()}
              />
            </Field>
            <Field
              id="seo-description"
              label="Descrição para o Google"
              optional
              counter={[(draft.seo.description || draft.summary).length, LIMITS.seoDescription.max]}
            >
              <textarea
                id="campo-seo-description"
                rows={3}
                value={draft.seo.description}
                onChange={(e) => update("seo", { ...draft.seo, description: e.target.value })}
                placeholder={draft.summary || "Usa o resumo"}
                className={inputClass()}
              />
            </Field>
            <GoogleSnippet
              title={draft.seo.title || draft.title}
              description={draft.seo.description || draft.summary}
            />
            {warnings.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-amber-800">
                {warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            )}
          </Card>

          <Link
            href={adminRoutes.news}
            className="text-center text-sm text-muted-foreground hover:underline"
          >
            ← Voltar para a lista
          </Link>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- peças

function inputClass(error?: string, extra?: string) {
  return cn(
    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
    error ? "border-destructive" : "border-input",
    extra,
  );
}

function Field({
  id,
  label,
  hint,
  error,
  optional,
  counter,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  counter?: [number, number];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`campo-${id}`} className="text-sm font-semibold">
          {label}{" "}
          {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
        </label>
        {counter && (
          <span
            className={cn(
              "text-xs tabular-nums",
              counter[0] > counter[1] ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
          >
            {counter[0]}/{counter[1]}
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <FieldError id={`erro-${id}`}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertCircleIcon aria-hidden className="size-3.5" /> {children}
    </p>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow-xs">
      <h2 className="font-heading text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:opacity-60",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-brand-blue-dark"
          : "border bg-background hover:border-brand-blue hover:text-brand-blue",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={cn("flex items-start gap-3", disabled && "opacity-60")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-brand-blue"
      />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          {description}
          {disabled && " Seu perfil não pode alterar."}
        </span>
      </span>
    </label>
  );
}

function SaveState({
  pending,
  dirty,
  savedAt,
}: {
  pending: boolean;
  dirty: boolean;
  savedAt: string | null;
}) {
  if (pending)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> Salvando…
      </span>
    );
  if (dirty)
    return (
      <span className="text-sm font-medium text-amber-700">
        Alterações não salvas (cópia guardada neste navegador)
      </span>
    );
  if (savedAt)
    return (
      <span className="text-sm text-emerald-700">Salvo às {time.format(new Date(savedAt))}</span>
    );
  return null;
}

// Imita o resultado do Google: as cores são as do próprio Google (interface de terceiro),
// por isso ficam fora dos tokens do projeto.
function GoogleSnippet({ title, description }: { title: string; description: string }) {
  const cut = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text;
  return (
    <div aria-label="Prévia no Google" className="rounded-md border bg-muted/40 p-3 text-sm">
      <p className="text-xs text-muted-foreground">zonasulurgente.com.br › …</p>
      <p className="mt-0.5 text-base leading-snug text-[#1a0dab]">
        {cut(title || "Título da matéria", 60)}
      </p>
      <p className="mt-0.5 text-xs leading-snug text-[#4d5156]">
        {cut(description || "Resumo da matéria.", 160)}
      </p>
    </div>
  );
}

function Preview({ draft, options }: { draft: NewsDraft; options: EditorOptions }) {
  const category = options.categories.find((c) => c.slug === draft.categorySlug);
  const place = options.neighborhoods.find((n) => n.slug === draft.neighborhoodSlug);
  const authorNames = options.authors
    .filter((a) => draft.authorSlugs.includes(a.slug))
    .map((a) => a.name);
  return (
    <article
      aria-label="Pré-visualização"
      className="flex flex-col gap-4 rounded-lg border bg-background p-6"
    >
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Pré-visualização
      </p>
      <div className="flex flex-wrap gap-2">
        {draft.isUrgent && (
          <span className="bg-urgent px-2 py-0.5 text-label font-bold text-urgent-foreground uppercase">
            Urgente
          </span>
        )}
        {draft.isSponsored && (
          <span className="bg-sponsored px-2 py-0.5 text-label font-bold text-sponsored-foreground uppercase">
            Patrocinado
          </span>
        )}
        <span className="text-label font-bold text-kicker uppercase">
          {category?.name ?? "Editoria"}
          {place && <span className="text-muted-foreground"> · {place.name}</span>}
        </span>
      </div>
      <h2 className="text-display">{draft.title || "Título da matéria"}</h2>
      {draft.subtitle && <p className="text-title font-normal">{draft.subtitle}</p>}
      <p className="text-sm">
        <span className="font-semibold underline">{authorNames.join(" e ") || "Autor"}</span>, do
        Zona Sul Urgente
      </p>
      {draft.image.url && (
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.image.url}
            alt={draft.image.alt}
            className="aspect-video w-full bg-muted object-cover"
          />
          {(draft.image.caption || draft.image.credit) && (
            <figcaption className="text-sm text-muted-foreground">
              {[draft.image.caption, draft.image.credit].filter(Boolean).join(" · ")}
            </figcaption>
          )}
        </figure>
      )}
      <div className="flex flex-col gap-5 text-article [&_a]:text-brand-blue [&_a]:underline">
        {draft.body.map((block, i) => {
          // O HTML vem do conversor do editor (texto escapado; só <strong>, <em>, <a>).
          if (block.type === "paragraph")
            return <p key={i} dangerouslySetInnerHTML={{ __html: block.html }} />;
          if (block.type === "heading")
            return (
              <h3 key={i} className="text-headline">
                {block.text}
              </h3>
            );
          if (block.type === "quote")
            return (
              <blockquote
                key={i}
                className="border-l-4 border-brand-red pl-5 font-heading text-title font-bold"
              >
                “{block.text}”
              </blockquote>
            );
          if (block.type === "list") {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag key={i} className={block.ordered ? "list-decimal pl-6" : "list-disc pl-6"}>
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ListTag>
            );
          }
          return null;
        })}
        {draft.body.length === 0 && <p className="text-muted-foreground">O texto aparece aqui.</p>}
      </div>
    </article>
  );
}
