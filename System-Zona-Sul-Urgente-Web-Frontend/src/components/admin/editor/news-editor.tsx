"use client";

import {
  AccessibilityIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
  CameraIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  EyeIcon,
  HashIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  MapPinIcon,
  PencilIcon,
  Settings2Icon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { saveNewsAction } from "@/app/admin/(painel)/noticias/actions";
import { RichTextEditor } from "@/components/admin/editor/rich-text-editor";
import { TagPicker } from "@/components/admin/editor/tag-picker";
import { StatusBadge } from "@/components/admin/status-badge";
import { adminRoutes } from "@/config/admin-navigation";
import { countWords } from "@/lib/editor/blocks";
import { extractHashtags, matchTags, newTagError, tagKey } from "@/lib/editor/tags";
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

/** Linhas que abrem/fecham (como "Adicionar localização" no Instagram). */
type RowKey = "place" | "authors" | "tags" | "a11y" | "advanced" | "instagram";

/** Em qual linha fica cada campo: a linha abre sozinha quando o campo tem erro. */
const rowOfError: Partial<Record<keyof DraftErrors, RowKey>> = {
  authorSlugs: "authors",
  newTags: "tags",
  "image.alt": "a11y",
  sponsorName: "advanced",
  scheduledFor: "advanced",
};

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

// Editor de notícia (FE-154) no formato do "Criar publicação" do Instagram (decisão
// 2026-10-15): a redação já posta lá, então a tela é familiar — mídia à esquerda, autor,
// título e texto à direita, e linhas que abrem para bairro, colaboradores, tópicos,
// acessibilidade e configurações avançadas. Proteções contra perda: cópia local automática,
// aviso ao sair com alterações e oferta de recuperar a cópia ao reabrir.
export function NewsEditor({ initial, options, permissions }: NewsEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [preview, setPreview] = useState(false);
  const [openRows, setOpenRows] = useState<Set<RowKey>>(() => new Set());
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

  function toggleRow(row: RowKey, open?: boolean) {
    setOpenRows((current) => {
      const next = new Set(current);
      if (open ?? !next.has(row)) next.add(row);
      else next.delete(row);
      return next;
    });
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

  function showErrors(next: DraftErrors) {
    setErrors(next);
    setPreview(false);
    // Abre as linhas que escondem campos com erro (o link da lista leva até eles).
    setOpenRows((current) => {
      const rows = new Set(current);
      for (const field of Object.keys(next) as (keyof DraftErrors)[]) {
        const row = rowOfError[field];
        if (row) rows.add(row);
      }
      return rows;
    });
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  function save(intent: SaveIntent) {
    const clientErrors = validateDraft(draft, intent);
    if (Object.keys(clientErrors).length > 0) {
      setMessage({ tone: "error", text: "Revise os campos destacados." });
      showErrors(clientErrors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveNewsAction(draft, intent);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        showErrors(result.errors);
        return;
      }
      setDraft((current) => ({
        ...current,
        id: result.id,
        status: result.status,
        version: result.version ?? current.version,
      }));
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

  // Hashtags do texto (como na legenda do Instagram) viram sugestão de tópico.
  const hashtagSuggestions = useMemo(() => {
    const text = draft.body
      .map((b) => (b.type === "paragraph" ? b.html.replace(/<[^>]+>/g, " ") : ""))
      .join(" ");
    return extractHashtags(text)
      .map((name) => ({ name, existing: matchTags(name, options.tags).existing }))
      .filter(({ name, existing }) =>
        existing
          ? !draft.tagSlugs.includes(existing.slug)
          : permissions.canCreateTags &&
            !newTagError(name) &&
            !draft.newTags.some((t) => tagKey(t) === tagKey(name)),
      );
  }, [draft.body, draft.tagSlugs, draft.newTags, options.tags, permissions.canCreateTags]);

  function addHashtags(list: typeof hashtagSuggestions) {
    const slugs = [...draft.tagSlugs];
    const created = [...draft.newTags];
    for (const { name, existing } of list) {
      if (existing) slugs.push(existing.slug);
      else created.push(name);
    }
    update("tagSlugs", slugs);
    update("newTags", created);
  }

  const errorList = Object.entries(errors).filter(([, value]) => value);
  const category = options.categories.find((c) => c.slug === draft.categorySlug);
  const place = options.neighborhoods.find((n) => n.slug === draft.neighborhoodSlug);
  const authorNames = options.authors
    .filter((a) => draft.authorSlugs.includes(a.slug))
    .map((a) => a.name);
  const tagNames = [
    ...options.tags.filter((t) => draft.tagSlugs.includes(t.slug)).map((t) => t.name),
    ...draft.newTags,
  ];

  const primary = permissions.canPublish
    ? draft.scheduledFor && draft.status !== "PUBLISHED"
      ? { label: "Agendar", intent: "schedule" as const }
      : {
          label: draft.status === "PUBLISHED" ? "Atualizar" : "Publicar",
          intent: "publish" as const,
        }
    : { label: "Enviar para revisão", intent: "review" as const };

  return (
    <div className="flex flex-col gap-4">
      {showBackup && backup && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
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
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm",
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
          className="rounded-lg border border-destructive/40 bg-background p-4 text-sm outline-none"
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

      <section
        aria-label={initial.id ? "Editar notícia" : "Nova notícia"}
        className="overflow-clip rounded-2xl border bg-background shadow-sm"
      >
        {/* Cabeçalho como o do "Criar publicação": voltar · título · compartilhar. */}
        <header className="sticky top-14 z-20 flex items-center gap-2 border-b bg-background/95 px-3 py-2.5 backdrop-blur sm:px-4 md:top-19">
          <Link
            href={adminRoutes.news}
            aria-label="Voltar para a lista de notícias"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeftIcon aria-hidden className="size-5" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
            <h1 className="truncate font-heading text-lg font-bold">
              {initial.id ? "Editar notícia" : "Nova notícia"}
            </h1>
            <StatusBadge status={draft.status} />
            <SaveState pending={pending} dirty={dirty} savedAt={savedAt} />
          </div>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            aria-pressed={preview}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
          >
            {preview ? (
              <PencilIcon aria-hidden className="size-4" />
            ) : (
              <EyeIcon aria-hidden className="size-4" />
            )}
            <span className="hidden sm:inline">{preview ? "Editar" : "Pré-visualizar"}</span>
          </button>
          <button
            type="button"
            onClick={() => save("draft")}
            disabled={pending}
            className="hidden h-9 items-center rounded-full px-3 text-sm font-semibold text-brand-blue hover:bg-brand-sky-light disabled:opacity-60 sm:inline-flex"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={() => save(primary.intent)}
            disabled={pending}
            className="inline-flex h-9 items-center rounded-full bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {primary.label}
          </button>
        </header>

        {preview ? (
          <div className="p-4 sm:p-6">
            <Preview draft={draft} options={options} />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* Mídia (como a foto do post). */}
            <div className="flex flex-col gap-3 border-b bg-muted/30 p-4 lg:border-r lg:border-b-0">
              <MediaPanel
                image={draft.image}
                error={errors["image.url"]}
                onChange={(image) => update("image", image)}
              />
            </div>

            {/* Texto e opções (como a coluna da legenda). */}
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-3 px-4 pt-4">
                <AuthorAvatars names={authorNames} />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-semibold">
                    {authorNames.join(", ") || "Escolha o autor"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {draft.origin === "INSTAGRAM" ? (
                      <span className="inline-flex items-center gap-1 text-brand-blue">
                        <CameraIcon aria-hidden className="size-3" /> Importada do Instagram
                      </span>
                    ) : (
                      "Zona Sul Urgente"
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
                <div>
                  <label htmlFor="campo-title" className="sr-only">
                    Título
                  </label>
                  {/* Cresce com o texto (títulos longos aparecem inteiros); Enter não quebra linha. */}
                  <textarea
                    id="campo-title"
                    rows={1}
                    value={draft.title}
                    onChange={(e) => update("title", e.target.value.replace(/\n/g, " "))}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    maxLength={LIMITS.title.max + 20}
                    placeholder="Título da notícia"
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={errors.title ? "erro-title" : undefined}
                    className={bareInput(
                      errors.title,
                      "field-sizing-content resize-none font-heading text-headline font-bold",
                    )}
                  />
                  <FieldFoot
                    id="title"
                    error={errors.title}
                    counter={[draft.title.length, LIMITS.title.max]}
                  />
                </div>

                <div>
                  <label htmlFor="campo-subtitle" className="sr-only">
                    Subtítulo (opcional)
                  </label>
                  <textarea
                    id="campo-subtitle"
                    rows={1}
                    value={draft.subtitle}
                    onChange={(e) => update("subtitle", e.target.value.replace(/\n/g, " "))}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    placeholder="Subtítulo (opcional)"
                    className={bareInput(
                      errors.subtitle,
                      "field-sizing-content resize-none text-title text-muted-foreground",
                    )}
                  />
                  {(errors.subtitle || draft.subtitle.length > LIMITS.subtitle.max * 0.8) && (
                    <FieldFoot
                      id="subtitle"
                      error={errors.subtitle}
                      counter={[draft.subtitle.length, LIMITS.subtitle.max]}
                    />
                  )}
                </div>

                <div id="campo-body" className="flex flex-col gap-1.5">
                  <RichTextEditor
                    key={editorKey}
                    bare
                    initialBlocks={draft.body}
                    onChange={onBodyChange}
                    placeholder="Escreva a notícia… (#hashtags viram tópicos)"
                    invalid={Boolean(errors.body)}
                    describedBy={errors.body ? "erro-body" : undefined}
                  />
                  <div className="flex items-center justify-between gap-2">
                    {errors.body ? <FieldError id="erro-body">{errors.body}</FieldError> : <span />}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {words} palavras · {Math.max(1, Math.round(words / 200))} min de leitura
                    </span>
                  </div>
                </div>

                {hashtagSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-brand-sky-light px-3 py-2 text-xs text-brand-blue">
                    <HashIcon aria-hidden className="size-3.5" />
                    <span>Usar como tópico:</span>
                    {hashtagSuggestions.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => addHashtags([s])}
                        className="rounded-full bg-background px-2 py-0.5 font-semibold ring-1 ring-brand-blue/30 hover:ring-brand-blue"
                      >
                        #{s.existing?.name ?? s.name}
                      </button>
                    ))}
                    {hashtagSuggestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => addHashtags(hashtagSuggestions)}
                        className="ml-auto font-semibold underline"
                      >
                        Adicionar todos
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="campo-summary" className="text-sm font-semibold">
                    Resumo
                  </label>
                  <textarea
                    id="campo-summary"
                    value={draft.summary}
                    onChange={(e) => update("summary", e.target.value)}
                    rows={2}
                    placeholder="Uma ou duas frases: aparece nos cards, no compartilhamento e no Google."
                    aria-invalid={Boolean(errors.summary)}
                    aria-describedby={errors.summary ? "erro-summary" : undefined}
                    className={bareInput(
                      errors.summary,
                      "mt-1 field-sizing-content min-h-16 resize-none rounded-lg bg-muted/50 px-3 py-2 text-sm",
                    )}
                  />
                  <FieldFoot
                    id="summary"
                    error={errors.summary}
                    counter={[draft.summary.length, LIMITS.summary.max]}
                  />
                </div>
              </div>

              {/* Obrigatórios e sempre à vista. */}
              <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="campo-categorySlug" className="text-sm font-semibold">
                    Editoria
                  </label>
                  <select
                    id="campo-categorySlug"
                    value={draft.categorySlug}
                    onChange={(e) => update("categorySlug", e.target.value)}
                    aria-invalid={Boolean(errors.categorySlug)}
                    aria-describedby={errors.categorySlug ? "erro-categorySlug" : undefined}
                    className={boxInput(errors.categorySlug)}
                  >
                    <option value="">Escolha…</option>
                    {options.categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
                      </option>
                    ))}
                  </select>
                  {errors.categorySlug && (
                    <FieldError id="erro-categorySlug">{errors.categorySlug}</FieldError>
                  )}
                </div>
                <Switch
                  id="campo-isUrgent"
                  label="Urgente"
                  description={
                    permissions.canMarkUrgent
                      ? "Selo vermelho e faixa de urgentes no site."
                      : "Seu perfil não pode marcar."
                  }
                  checked={draft.isUrgent}
                  disabled={!permissions.canMarkUrgent}
                  tone="urgent"
                  onChange={(v) => update("isUrgent", v)}
                />
              </div>

              <ul className="divide-y border-t">
                <Row
                  icon={MapPinIcon}
                  label="Adicionar bairro"
                  value={place?.name}
                  open={openRows.has("place")}
                  onToggle={() => toggleRow("place")}
                >
                  <label htmlFor="campo-neighborhoodSlug" className="sr-only">
                    Bairro
                  </label>
                  <select
                    id="campo-neighborhoodSlug"
                    value={draft.neighborhoodSlug}
                    onChange={(e) => update("neighborhoodSlug", e.target.value)}
                    className={boxInput()}
                  >
                    <option value="">Sem bairro específico</option>
                    {options.neighborhoods.map((n) => (
                      <option key={n.slug} value={n.slug}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </Row>

                <Row
                  icon={UsersIcon}
                  label="Colaboradores"
                  value={authorNames.length > 1 ? `${authorNames.length} autores` : authorNames[0]}
                  invalid={Boolean(errors.authorSlugs)}
                  open={openRows.has("authors")}
                  onToggle={() => toggleRow("authors")}
                >
                  <fieldset id="campo-authorSlugs" className="flex flex-col gap-2">
                    <legend className="sr-only">Autores</legend>
                    <div className="grid gap-1.5 sm:grid-cols-2">
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
                    </div>
                    {errors.authorSlugs && (
                      <FieldError id="erro-authorSlugs">{errors.authorSlugs}</FieldError>
                    )}
                  </fieldset>
                </Row>

                <Row
                  icon={HashIcon}
                  label="Tópicos"
                  value={
                    tagNames.length > 2
                      ? `${tagNames.slice(0, 2).join(", ")} +${tagNames.length - 2}`
                      : tagNames.join(", ") || undefined
                  }
                  invalid={Boolean(errors.newTags)}
                  open={openRows.has("tags")}
                  onToggle={() => toggleRow("tags")}
                >
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
                </Row>

                <Row
                  icon={AccessibilityIcon}
                  label="Acessibilidade"
                  value={draft.image.alt ? "Texto alternativo ok" : undefined}
                  invalid={Boolean(errors["image.alt"])}
                  open={openRows.has("a11y")}
                  onToggle={() => toggleRow("a11y")}
                >
                  <label htmlFor="campo-image-alt" className="text-sm font-semibold">
                    Texto alternativo da foto
                  </label>
                  <input
                    id="campo-image-alt"
                    value={draft.image.alt}
                    onChange={(e) => update("image", { ...draft.image, alt: e.target.value })}
                    placeholder="Ex.: Carros parados em rua alagada em Copacabana"
                    aria-invalid={Boolean(errors["image.alt"])}
                    className={boxInput(errors["image.alt"])}
                  />
                  <p className="text-xs text-muted-foreground">
                    Descreva a foto para quem usa leitor de tela. Também ajuda no Google Imagens.
                  </p>
                  {errors["image.alt"] && (
                    <FieldError id="erro-image-alt">{errors["image.alt"]}</FieldError>
                  )}
                </Row>

                <Row
                  icon={Settings2Icon}
                  label="Configurações avançadas"
                  value={
                    [
                      draft.scheduledFor && "agendada",
                      draft.isSponsored && "patrocinada",
                      (draft.seo.title || draft.seo.description) && "SEO",
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  invalid={Boolean(errors.sponsorName || errors.scheduledFor)}
                  open={openRows.has("advanced")}
                  onToggle={() => toggleRow("advanced")}
                >
                  <div className="flex flex-col gap-4">
                    {draft.status !== "PUBLISHED" && permissions.canPublish && (
                      <div className="flex flex-col gap-1">
                        <label htmlFor="campo-scheduledFor" className="text-sm font-semibold">
                          Agendar publicação{" "}
                          <span className="font-normal text-muted-foreground">(opcional)</span>
                        </label>
                        <input
                          id="campo-scheduledFor"
                          type="datetime-local"
                          value={draft.scheduledFor}
                          onChange={(e) => update("scheduledFor", e.target.value)}
                          className={boxInput(errors.scheduledFor)}
                        />
                        {errors.scheduledFor && (
                          <FieldError id="erro-scheduledFor">{errors.scheduledFor}</FieldError>
                        )}
                      </div>
                    )}
                    <Switch
                      id="campo-isSponsored"
                      label="Matéria patrocinada"
                      description={
                        permissions.canMarkSponsored
                          ? "Selo “Patrocinado” em todo o site; fica fora dos feeds e das Mais Lidas."
                          : "Seu perfil não pode marcar."
                      }
                      checked={draft.isSponsored}
                      disabled={!permissions.canMarkSponsored}
                      onChange={(v) => update("isSponsored", v)}
                    />
                    {draft.isSponsored && (
                      <div className="flex flex-col gap-1">
                        <label htmlFor="campo-sponsorName" className="text-sm font-semibold">
                          Patrocinador
                        </label>
                        <input
                          id="campo-sponsorName"
                          value={draft.sponsorName}
                          onChange={(e) => update("sponsorName", e.target.value)}
                          className={boxInput(errors.sponsorName)}
                        />
                        {errors.sponsorName && (
                          <FieldError id="erro-sponsorName">{errors.sponsorName}</FieldError>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <label htmlFor="campo-seo-title" className="text-sm font-semibold">
                          Título para o Google{" "}
                          <span className="font-normal text-muted-foreground">(opcional)</span>
                        </label>
                        <Counter
                          value={(draft.seo.title || draft.title).length}
                          max={LIMITS.seoTitle.max}
                        />
                      </div>
                      <input
                        id="campo-seo-title"
                        value={draft.seo.title}
                        onChange={(e) => update("seo", { ...draft.seo, title: e.target.value })}
                        placeholder={draft.title || "Usa o título da matéria"}
                        className={boxInput()}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <label htmlFor="campo-seo-description" className="text-sm font-semibold">
                          Descrição para o Google{" "}
                          <span className="font-normal text-muted-foreground">(opcional)</span>
                        </label>
                        <Counter
                          value={(draft.seo.description || draft.summary).length}
                          max={LIMITS.seoDescription.max}
                        />
                      </div>
                      <textarea
                        id="campo-seo-description"
                        rows={2}
                        value={draft.seo.description}
                        onChange={(e) =>
                          update("seo", { ...draft.seo, description: e.target.value })
                        }
                        placeholder={draft.summary || "Usa o resumo"}
                        className={boxInput()}
                      />
                    </div>
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
                  </div>
                </Row>

                {draft.instagramCaption && (
                  <Row
                    icon={CameraIcon}
                    label="Post original do Instagram"
                    value="somente leitura"
                    open={openRows.has("instagram")}
                    onToggle={() => toggleRow("instagram")}
                  >
                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                      {draft.instagramCaption}
                    </p>
                  </Row>
                )}
              </ul>

              {/* Celular: "Salvar rascunho" some do cabeçalho; fica aqui no fim. */}
              <div className="border-t p-4 sm:hidden">
                <button
                  type="button"
                  onClick={() => save("draft")}
                  disabled={pending}
                  className="h-10 w-full rounded-full border text-sm font-semibold text-brand-blue disabled:opacity-60"
                >
                  Salvar rascunho
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      {category && <span className="sr-only">Editoria: {category.name}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- peças

/** Campo sem moldura (título, texto): integrado ao painel, como a legenda do post. */
function bareInput(error?: string, extra?: string) {
  return cn(
    "w-full bg-transparent outline-none placeholder:text-muted-foreground/70",
    error && "rounded-md ring-2 ring-destructive/60",
    extra,
  );
}

function boxInput(error?: string) {
  return cn(
    "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 [&:is(textarea)]:h-auto [&:is(textarea)]:py-2",
    error ? "border-destructive" : "border-input",
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        value > max ? "font-semibold text-destructive" : "text-muted-foreground",
      )}
    >
      {value}/{max}
    </span>
  );
}

function FieldFoot({
  id,
  error,
  counter,
}: {
  id: string;
  error?: string;
  counter: [number, number];
}) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2">
      {error ? <FieldError id={`erro-${id}`}>{error}</FieldError> : <span />}
      <Counter value={counter[0]} max={counter[1]} />
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

/** Linha que abre/fecha, com o valor atual à direita (estilo das opções do post). */
function Row({
  icon: Icon,
  label,
  value,
  invalid,
  open,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value?: string;
  invalid?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = useId();
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-muted/50"
      >
        <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{label}</span>
        {invalid && <AlertCircleIcon aria-label="tem erro" className="size-4 text-destructive" />}
        <span className="ml-auto truncate text-muted-foreground">{value}</span>
        <ChevronDownIcon
          aria-hidden
          className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")}
        />
      </button>
      <div id={panelId} hidden={!open} className="flex flex-col gap-2 px-4 pb-4">
        {children}
      </div>
    </li>
  );
}

/** Chave liga/desliga (estilo dos ajustes do Instagram). */
function Switch({
  id,
  label,
  description,
  checked,
  disabled,
  tone = "brand",
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  tone?: "brand" | "urgent";
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn("flex items-center gap-3", disabled ? "opacity-60" : "cursor-pointer")}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-muted-foreground/30 transition outline-none before:absolute before:top-0.5 before:left-0.5 before:size-5 before:rounded-full before:bg-white before:shadow-sm before:transition checked:before:translate-x-5 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed",
          tone === "urgent" ? "checked:bg-urgent" : "checked:bg-brand-blue",
        )}
      />
    </label>
  );
}

function AuthorAvatars({ names }: { names: string[] }) {
  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("");
  if (names.length === 0)
    return (
      <span aria-hidden className="size-10 shrink-0 rounded-full bg-muted ring-2 ring-brand-red" />
    );
  return (
    <span aria-hidden className="flex shrink-0 -space-x-3">
      {names.slice(0, 3).map((name) => (
        <span
          key={name}
          className="flex size-10 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white ring-2 ring-background outline-2 outline-offset-2 outline-brand-red first:outline"
        >
          {initials(name)}
        </span>
      ))}
    </span>
  );
}

/**
 * Foto principal, como a mídia do post: arraste/seleção do arquivo ou endereço da imagem.
 * Sem armazenamento de mídia ainda (BE-012), o arquivo escolhido só é exibido aqui
 * (endereço temporário do navegador); o envio de verdade entra com o backend.
 */
function MediaPanel({
  image,
  error,
  onChange,
}: {
  image: NewsDraft["image"];
  error?: string;
  onChange: (image: NewsDraft["image"]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const hasImage = /^(https?:|blob:)/.test(image.url);
  // Endereço que o navegador não conseguiu abrir como imagem (ex.: a página da foto no
  // Unsplash em vez do arquivo). Guardado por endereço: trocar o link limpa o aviso.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const broken = hasImage && brokenUrl === image.url;

  function pickFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    onChange({ ...image, url: URL.createObjectURL(file) });
  }

  return (
    <>
      <div
        id="campo-image-url"
        tabIndex={-1}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "relative flex aspect-4/3 w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-background text-center outline-none sm:aspect-square lg:aspect-4/5",
          dragging
            ? "border-brand-blue bg-brand-sky-light"
            : error
              ? "border-destructive"
              : "border-border",
          hasImage && "border-solid border-transparent bg-foreground",
        )}
      >
        {hasImage ? (
          <>
            {/* Prévia simples (sem otimização): o endereço ainda não foi validado pelo servidor. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt=""
              onError={() => setBrokenUrl(image.url)}
              className={cn("size-full object-contain", broken && "invisible")}
            />
            <div className="absolute right-2 bottom-2 flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-background/90 px-3 text-xs font-semibold shadow backdrop-blur hover:bg-background"
              >
                <ImagePlusIcon aria-hidden className="size-4" /> Trocar
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...image, url: "" })}
                aria-label="Remover foto"
                className="inline-flex size-9 items-center justify-center rounded-full bg-background/90 shadow backdrop-blur hover:bg-background hover:text-destructive"
              >
                <Trash2Icon aria-hidden className="size-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 p-6">
            <ImagePlusIcon aria-hidden className="size-14 stroke-1 text-muted-foreground" />
            <p className="font-heading text-lg font-bold">Arraste a foto principal aqui</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-9 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-dark"
            >
              Selecionar do computador
            </button>
            <button
              type="button"
              onClick={() => setShowUrl((v) => !v)}
              className="text-xs font-semibold text-brand-blue hover:underline"
            >
              ou colar o endereço da imagem
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher foto principal"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>
      {error && <FieldError id="erro-image-url">{error}</FieldError>}
      {broken && !error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          Não foi possível abrir uma imagem nesse endereço. Use o link do arquivo da foto: clique
          com o botão direito na imagem e escolha &ldquo;Copiar endereço da imagem&rdquo;.
        </p>
      )}

      {(showUrl || (image.url && !image.url.startsWith("blob:"))) && (
        <div className="flex flex-col gap-1">
          <label htmlFor="campo-image-endereco" className="text-xs font-semibold">
            Endereço da imagem
          </label>
          <input
            id="campo-image-endereco"
            type="url"
            value={image.url.startsWith("blob:") ? "" : image.url}
            onChange={(e) => onChange({ ...image, url: e.target.value })}
            placeholder="https://"
            className={boxInput()}
          />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="campo-image-caption" className="text-xs font-semibold">
            Legenda da foto <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="campo-image-caption"
            value={image.caption}
            onChange={(e) => onChange({ ...image, caption: e.target.value })}
            className={boxInput()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="campo-image-credit" className="text-xs font-semibold">
            Crédito <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="campo-image-credit"
            value={image.credit}
            onChange={(e) => onChange({ ...image, credit: e.target.value })}
            placeholder="Foto: Fulano/Zona Sul Urgente"
            className={boxInput()}
          />
        </div>
      </div>
    </>
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
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <LoaderCircleIcon aria-hidden className="size-3.5 animate-spin" /> Salvando…
      </span>
    );
  if (dirty)
    return (
      <span
        title="Uma cópia fica guardada neste navegador até você salvar."
        className="text-xs font-medium text-amber-700"
      >
        Alterações não salvas
      </span>
    );
  if (savedAt)
    return (
      <span className="text-xs text-emerald-700">Salvo às {time.format(new Date(savedAt))}</span>
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
    <article aria-label="Pré-visualização" className="mx-auto flex max-w-3xl flex-col gap-4">
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
