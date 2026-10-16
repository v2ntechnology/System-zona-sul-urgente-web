"use client";

import {
  AlertCircleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CornerDownRightIcon,
  InfoIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { slugify } from "@/config/navigation";
import { SECTION_COLORS, sectionStyle } from "@/lib/section-color";
import {
  CATEGORY_LIMITS,
  type CategoryDraft,
  type CategoryErrors,
  validateCategory,
} from "@/lib/taxonomy/validate";
import { cn } from "@/lib/utils";
import type { SectionColor } from "@/types/news";

export type ManagedCategory = {
  id: string;
  name: string;
  slug: string;
  parentSlug?: string;
  color?: SectionColor;
  inBar: boolean;
  active: boolean;
  order: number;
  whatsappUrl: string;
  description: string;
  newsCount: number;
  /** Endereço anterior (mudou o slug): redireciona com 308. */
  previousSlug?: string;
};

const emptyDraft: CategoryDraft = {
  name: "",
  slug: "",
  parentSlug: "",
  color: "",
  inBar: false,
  whatsappUrl: "",
  description: "",
};

// Editorias (FE-158): ordem, barra, ativação e cadastro. A barra azul do topo da tela é
// uma prévia do menu do site com as mudanças. Sem backend, tudo é simulado na tela; com a
// API: POST/PUT /api/v1/admin/categories e revalidação do menu (tag de cache "taxonomy").
export function CategoriesManager({ initial }: { initial: ManagedCategory[] }) {
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<CategoryDraft | null>(null);
  const [errors, setErrors] = useState<CategoryErrors>({});
  const [slugTouched, setSlugTouched] = useState(false);

  const roots = items.filter((c) => !c.parentSlug).sort((a, b) => a.order - b.order);
  const childrenOf = (slug: string) =>
    items.filter((c) => c.parentSlug === slug).sort((a, b) => a.order - b.order);
  const bar = roots.filter((c) => c.active && c.inBar);

  const say = (text: string) => setMessage(`${text} (simulação — sem backend conectado).`);

  function move(item: ManagedCategory, direction: -1 | 1) {
    const siblings = (item.parentSlug ? childrenOf(item.parentSlug) : roots).map((c) => c.id);
    const index = siblings.indexOf(item.id);
    const target = siblings[index + direction];
    if (!target) return;
    setItems((list) =>
      list.map((c) =>
        c.id === item.id
          ? { ...c, order: list.find((x) => x.id === target)!.order }
          : c.id === target
            ? { ...c, order: item.order }
            : c,
      ),
    );
    say(`“${item.name}” ${direction < 0 ? "subiu" : "desceu"} no menu`);
  }

  function setActive(item: ManagedCategory, active: boolean) {
    setItems((list) =>
      list.map((c) =>
        c.id === item.id || (!active && c.parentSlug === item.slug) ? { ...c, active } : c,
      ),
    );
    say(
      active
        ? `“${item.name}” voltou ao menu`
        : `“${item.name}” saiu do menu; as ${item.newsCount} matérias continuam no ar`,
    );
  }

  function remove(item: ManagedCategory) {
    setItems((list) => list.filter((c) => c.id !== item.id));
    say(`“${item.name}” excluída`);
  }

  function open(item?: ManagedCategory, parentSlug = "") {
    setErrors({});
    setSlugTouched(Boolean(item));
    setEditing(
      item
        ? {
            id: item.id,
            name: item.name,
            slug: item.slug,
            parentSlug: item.parentSlug ?? "",
            color: item.color ?? "",
            inBar: item.inBar,
            whatsappUrl: item.whatsappUrl,
            description: item.description,
          }
        : { ...emptyDraft, parentSlug },
    );
  }

  function update<K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]) {
    setEditing((d) => {
      if (!d) return d;
      const next = { ...d, [key]: value };
      // O endereço acompanha o nome até a pessoa mexer nele.
      if (key === "name" && !slugTouched) next.slug = slugify(String(value)).slice(0, 40);
      if (key === "parentSlug" && value) next.inBar = false;
      return next;
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const found = validateCategory(
      editing,
      items.map((c) => ({
        id: c.id,
        slug: c.slug,
        parentSlug: c.parentSlug,
        inBar: c.inBar && c.active,
      })),
    );
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const before = items.find((c) => c.id === editing.id);
    const fields = {
      name: editing.name.trim(),
      slug: editing.slug,
      parentSlug: editing.parentSlug || undefined,
      color: editing.parentSlug ? undefined : (editing.color as SectionColor),
      inBar: !editing.parentSlug && editing.inBar,
      whatsappUrl: editing.whatsappUrl.trim(),
      description: editing.description.trim(),
    };
    if (before) {
      setItems((list) =>
        list.map((c) =>
          c.id === before.id
            ? {
                ...c,
                ...fields,
                previousSlug: before.slug !== fields.slug ? before.slug : c.previousSlug,
              }
            : c.parentSlug === before.slug
              ? { ...c, parentSlug: fields.slug }
              : c,
        ),
      );
      say(
        before.slug !== fields.slug
          ? `“${fields.name}” salva; /${before.slug} agora redireciona para /${fields.slug}`
          : `“${fields.name}” salva`,
      );
    } else {
      const siblings = fields.parentSlug ? childrenOf(fields.parentSlug) : roots;
      setItems((list) => [
        ...list,
        {
          id: crypto.randomUUID(),
          ...fields,
          active: true,
          order: Math.max(0, ...siblings.map((c) => c.order)) + 1,
          newsCount: 0,
        },
      ]);
      say(`“${fields.name}” criada`);
    }
    setEditing(null);
  }

  const original = editing?.id ? items.find((c) => c.id === editing.id) : undefined;
  const hasChildren = original ? childrenOf(original.slug).length > 0 : false;

  return (
    <div className="flex flex-col gap-5">
      {/* Prévia do menu do site (barra azul), com as mudanças feitas aqui. */}
      <section aria-labelledby="previa-barra" className="flex flex-col gap-2">
        <h2 id="previa-barra" className="text-sm font-semibold">
          Como fica a barra do site{" "}
          <span className="font-normal text-muted-foreground">
            ({bar.length} de {CATEGORY_LIMITS.inBar})
          </span>
        </h2>
        <div className="flex [scrollbar-width:none] items-center gap-5 overflow-x-auto rounded-lg bg-masthead px-4 py-3">
          <span className="shrink-0 font-logo text-xs font-extrabold text-white uppercase">
            ZSU
          </span>
          {bar.map((c) => (
            <span key={c.id} className="shrink-0 text-sm font-medium whitespace-nowrap text-white">
              {c.name}
            </span>
          ))}
          {bar.length === 0 && (
            <span className="text-sm text-white/70">Nenhuma editoria na barra.</span>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {roots.length} editorias · {items.length - roots.length} subeditorias e colunas
        </p>
        <button
          type="button"
          onClick={() => open()}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          <PlusIcon aria-hidden className="size-4" /> Nova editoria
        </button>
      </div>
      <p
        aria-live="polite"
        className={
          message ? "rounded-md bg-brand-sky-light px-3 py-2 text-sm text-brand-blue" : "sr-only"
        }
      >
        {message}
      </p>

      <ul className="flex flex-col gap-3">
        {roots.map((root, i) => (
          <li key={root.id} className="overflow-hidden rounded-xl border bg-background shadow-xs">
            <Row
              item={root}
              first={i === 0}
              last={i === roots.length - 1}
              onMove={move}
              onEdit={() => open(root)}
              onAddChild={() => open(undefined, root.slug)}
              onActive={setActive}
              onRemove={remove}
            />
            {childrenOf(root.slug).length > 0 && (
              <ul className="divide-y border-t bg-muted/30">
                {childrenOf(root.slug).map((child, j, all) => (
                  <li key={child.id}>
                    <Row
                      item={child}
                      parentColor={root.color}
                      first={j === 0}
                      last={j === all.length - 1}
                      onMove={move}
                      onEdit={() => open(child)}
                      onActive={setActive}
                      onRemove={remove}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-5 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        >
          <SheetTitle className="font-heading text-lg font-bold">
            {editing?.id
              ? "Editar editoria"
              : editing?.parentSlug
                ? "Nova subeditoria"
                : "Nova editoria"}
          </SheetTitle>
          <SheetDescription>
            Aparece no menu do site, nas páginas de editoria e no editor de notícias.
          </SheetDescription>
          {editing && (
            <form onSubmit={save} noValidate className="flex flex-col gap-4">
              {/* Prévia do título da editoria, como no site ("Economia■"). */}
              <div
                style={sectionStyle({
                  slug: editing.slug,
                  color: editing.parentSlug
                    ? items.find((c) => c.slug === editing.parentSlug)?.color
                    : editing.color || undefined,
                })}
                className="rounded-lg border bg-background px-4 py-3"
              >
                <p className="text-xs text-muted-foreground">
                  zonasulurgente.com.br/
                  {editing.parentSlug ? `${editing.parentSlug}/` : ""}
                  <strong className="text-foreground">{editing.slug || "endereco"}</strong>
                </p>
                <p className="font-heading text-headline font-bold text-[color:var(--section)]">
                  {editing.name || "Nome da editoria"}
                  <span
                    aria-hidden
                    className="ml-1 inline-block size-[0.26em] bg-[color:var(--section)]"
                  />
                </p>
              </div>

              <Field label="Nome" htmlFor="cat-name" error={errors.name}>
                <input
                  id="cat-name"
                  value={editing.name}
                  onChange={(e) => update("name", e.target.value)}
                  maxLength={CATEGORY_LIMITS.name + 10}
                  className={inputClass(errors.name)}
                  autoFocus
                />
              </Field>
              <Field
                label="Endereço (slug)"
                htmlFor="cat-slug"
                error={errors.slug}
                hint={
                  original && original.slug !== editing.slug && !errors.slug
                    ? `Mudar o endereço faz /${original.slug} redirecionar para /${editing.slug} (308): links antigos e o Google não se perdem.`
                    : undefined
                }
              >
                <input
                  id="cat-slug"
                  value={editing.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }}
                  className={inputClass(errors.slug)}
                />
              </Field>
              <Field label="Editoria mãe" htmlFor="cat-parent" error={errors.parentSlug}>
                <select
                  id="cat-parent"
                  value={editing.parentSlug}
                  disabled={hasChildren}
                  onChange={(e) => update("parentSlug", e.target.value)}
                  className={inputClass(errors.parentSlug)}
                >
                  <option value="">Nenhuma (editoria principal)</option>
                  {roots
                    .filter((r) => r.id !== editing.id)
                    .map((r) => (
                      <option key={r.id} value={r.slug}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </Field>
              {editing.parentSlug ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon aria-hidden className="size-3.5" /> Subeditoria usa a cor da mãe e
                  aparece no menu ☰ dentro dela.
                </p>
              ) : (
                <>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-semibold">Cor</legend>
                    <div className="flex flex-wrap gap-2">
                      {SECTION_COLORS.map((c) => (
                        <label
                          key={c.key}
                          title={c.label}
                          style={sectionStyle({ slug: c.key, color: c.key })}
                          className="relative cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="cat-color"
                            value={c.key}
                            checked={editing.color === c.key}
                            onChange={() => update("color", c.key)}
                            className="peer sr-only"
                          />
                          <span className="block size-8 rounded-full bg-[color:var(--section)] ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
                          <span className="sr-only">{c.label}</span>
                        </label>
                      ))}
                    </div>
                    {errors.color && <FieldError>{errors.color}</FieldError>}
                  </fieldset>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={editing.inBar}
                      onChange={(e) => update("inBar", e.target.checked)}
                      className="mt-0.5 size-4 accent-brand-blue"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">Aparece na barra do site</span>
                      <span className="text-xs text-muted-foreground">
                        Sem marcar, fica só no menu ☰ e no rodapé (como a CNN).
                      </span>
                    </span>
                  </label>
                  {errors.inBar && <FieldError>{errors.inBar}</FieldError>}
                </>
              )}
              <Field
                label="Canal do WhatsApp (opcional)"
                htmlFor="cat-whatsapp"
                error={errors.whatsappUrl}
                hint="Aparece como “Acompanhe no WhatsApp” nas matérias da editoria."
              >
                <input
                  id="cat-whatsapp"
                  type="url"
                  value={editing.whatsappUrl}
                  onChange={(e) => update("whatsappUrl", e.target.value)}
                  placeholder="https://whatsapp.com/channel/..."
                  className={inputClass(errors.whatsappUrl)}
                />
              </Field>
              <Field
                label="Descrição (Google e topo da página)"
                htmlFor="cat-description"
                error={errors.description}
                hint={`${editing.description.length}/${CATEGORY_LIMITS.description}`}
              >
                <textarea
                  id="cat-description"
                  rows={3}
                  value={editing.description}
                  onChange={(e) => update("description", e.target.value)}
                  className={cn(inputClass(errors.description), "h-auto py-2")}
                />
              </Field>
              <button
                type="submit"
                className="h-10 rounded-full bg-brand-blue text-sm font-semibold text-white hover:bg-brand-blue-dark"
              >
                Salvar
              </button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({
  item,
  parentColor,
  first,
  last,
  onMove,
  onEdit,
  onAddChild,
  onActive,
  onRemove,
}: {
  item: ManagedCategory;
  parentColor?: SectionColor;
  first: boolean;
  last: boolean;
  onMove: (item: ManagedCategory, direction: -1 | 1) => void;
  onEdit: () => void;
  onAddChild?: () => void;
  onActive: (item: ManagedCategory, active: boolean) => void;
  onRemove: (item: ManagedCategory) => void;
}) {
  const child = Boolean(item.parentSlug);
  return (
    <div
      style={sectionStyle({ slug: item.slug, color: item.color ?? parentColor })}
      className={cn("flex items-center gap-3 px-3 py-3 sm:px-4", !item.active && "opacity-60")}
    >
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          disabled={first}
          onClick={() => onMove(item, -1)}
          aria-label={`Subir ${item.name}`}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ArrowUpIcon aria-hidden className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={last}
          onClick={() => onMove(item, 1)}
          aria-label={`Descer ${item.name}`}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ArrowDownIcon aria-hidden className="size-3.5" />
        </button>
      </div>
      {child ? (
        <CornerDownRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <span aria-hidden className="size-3 shrink-0 rounded-full bg-[color:var(--section)]" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "truncate text-left hover:text-brand-blue hover:underline",
            child ? "text-sm font-medium" : "font-semibold",
          )}
        >
          {item.name}
        </button>
        <span className="truncate text-xs text-muted-foreground">
          /{item.parentSlug ? `${item.parentSlug}/` : ""}
          {item.slug}
          {item.previousSlug && ` · antes /${item.previousSlug} (redireciona)`}
        </span>
      </div>
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {item.inBar && item.active && (
          <span className="rounded-full bg-brand-sky-light px-2 py-0.5 text-xs font-semibold text-brand-blue">
            Na barra
          </span>
        )}
        {!item.active && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            Desativada
          </span>
        )}
      </div>
      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {item.newsCount === 1 ? "1 matéria" : `${item.newsCount} matérias`}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Ações para ${item.name}`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
          {onAddChild && <DropdownMenuItem onClick={onAddChild}>Nova subeditoria</DropdownMenuItem>}
          <DropdownMenuSeparator />
          {item.active ? (
            <DropdownMenuItem onClick={() => onActive(item, false)}>
              Desativar (sai do menu)
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onActive(item, true)}>Reativar</DropdownMenuItem>
          )}
          {/* Editoria com matérias nunca é apagada: só desativada (links continuam valendo). */}
          {item.newsCount === 0 && (
            <DropdownMenuItem variant="destructive" onClick={() => onRemove(item)}>
              Excluir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertCircleIcon aria-hidden className="size-3.5" /> {children}
    </p>
  );
}

function inputClass(error?: string) {
  return cn(
    "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60",
    error ? "border-destructive" : "border-input",
  );
}
