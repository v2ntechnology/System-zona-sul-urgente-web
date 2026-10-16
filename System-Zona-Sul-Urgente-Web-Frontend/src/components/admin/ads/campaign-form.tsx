"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ImagePlusIcon,
  LoaderCircleIcon,
  MapPinIcon,
  NewspaperIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { adminRoutes } from "@/config/admin-navigation";
import { type CampaignErrors, formatSize, sizeFits, validateCampaign } from "@/lib/ads/validate";
import { cn } from "@/lib/utils";
import type { CampaignDraft } from "@/types/admin";
import type { AdSize, AdSlotKey } from "@/types/news";

type Option = { slug: string; name: string };

type CampaignFormProps = {
  advertisers: { id: string; name: string }[];
  slots: { key: AdSlotKey; label: string; sizes: AdSize[] }[];
  categories: Option[];
  neighborhoods: Option[];
};

const empty: CampaignDraft = {
  name: "",
  advertiserId: "",
  startsAt: "",
  endsAt: "",
  slots: [],
  categories: [],
  neighborhoods: [],
  clickUrl: "https://",
  goalImpressions: "",
  creatives: {},
};

// Nova campanha (FE-157). A peça de cada posição tem o tamanho lido no navegador e é
// recusada na hora se não for um dos tamanhos aceitos (padrão IAB). Sem armazenamento de
// mídia (BE-012) e sem API, salvar é simulado.
export function CampaignForm({ advertisers, slots, categories, neighborhoods }: CampaignFormProps) {
  const [draft, setDraft] = useState(empty);
  const [errors, setErrors] = useState<CampaignErrors>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const slotSizes = Object.fromEntries(slots.map((s) => [s.key, s.sizes])) as Record<
    AdSlotKey,
    AdSize[]
  >;

  function update<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  function setCreative(slot: AdSlotKey, creative: CampaignDraft["creatives"][AdSlotKey]) {
    setDraft((d) => ({ ...d, creatives: { ...d.creatives, [slot]: creative } }));
    setErrors((e) => ({ ...e, [`creative-${slot}`]: undefined }));
  }

  function save(intent: "draft" | "submit") {
    const found = validateCampaign(draft, slotSizes, intent);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMessage({ tone: "error", text: "Revise os campos destacados." });
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setMessage({
        tone: "ok",
        text: `${intent === "draft" ? "Rascunho salvo" : "Campanha agendada"} (simulação — sem backend conectado).`,
      });
    }, 500);
  }

  const errorList = Object.entries(errors).filter(([, v]) => v);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-heading text-headline font-bold">Nova campanha</h2>

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
                <a href={`#campo-${field}`} className="underline">
                  {text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Campanha">
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="name" label="Nome" error={errors.name}>
            <input
              id="campo-name"
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Ex.: Promoção de verão"
              className={inputClass(errors.name)}
            />
          </Field>
          <Field id="advertiserId" label="Anunciante" error={errors.advertiserId}>
            <select
              id="campo-advertiserId"
              value={draft.advertiserId}
              onChange={(e) => update("advertiserId", e.target.value)}
              className={inputClass(errors.advertiserId)}
            >
              <option value="">Escolha…</option>
              {advertisers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="startsAt" label="Início" error={errors.startsAt}>
            <input
              id="campo-startsAt"
              type="date"
              value={draft.startsAt}
              onChange={(e) => update("startsAt", e.target.value)}
              className={inputClass(errors.startsAt)}
            />
          </Field>
          <Field id="endsAt" label="Fim" error={errors.endsAt}>
            <input
              id="campo-endsAt"
              type="date"
              value={draft.endsAt}
              min={draft.startsAt || undefined}
              onChange={(e) => update("endsAt", e.target.value)}
              className={inputClass(errors.endsAt)}
            />
          </Field>
          <Field
            id="clickUrl"
            label="Link de destino"
            hint="Para onde vai quem clica. Use https://."
            error={errors.clickUrl}
          >
            <input
              id="campo-clickUrl"
              type="url"
              value={draft.clickUrl}
              onChange={(e) => update("clickUrl", e.target.value)}
              className={inputClass(errors.clickUrl)}
            />
          </Field>
          <Field
            id="goalImpressions"
            label="Meta de impressões (opcional)"
            hint="Quantas exibições foram vendidas."
            error={errors.goalImpressions}
          >
            <input
              id="campo-goalImpressions"
              inputMode="numeric"
              value={draft.goalImpressions}
              onChange={(e) => update("goalImpressions", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="Ex.: 150000"
              className={inputClass(errors.goalImpressions)}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Posições e peças"
        subtitle="Marque onde o anúncio aparece e envie uma imagem em um dos tamanhos aceitos de cada posição."
      >
        <fieldset id="campo-slots" className="flex flex-col gap-3">
          <legend className="sr-only">Posições</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {slots.map((slot) => {
              const on = draft.slots.includes(slot.key);
              return (
                <label
                  key={slot.key}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                    on ? "border-brand-blue bg-brand-sky-light" : "hover:border-muted-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => update("slots", toggle(draft.slots, slot.key) as AdSlotKey[])}
                    className="mt-0.5 size-4 accent-brand-blue"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{slot.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {slot.sizes.map(formatSize).join(" · ")}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {errors.slots && <FieldError>{errors.slots}</FieldError>}
        </fieldset>

        {draft.slots.length > 0 && (
          <ul className="flex flex-col gap-3">
            {slots
              .filter((s) => draft.slots.includes(s.key))
              .map((slot) => (
                <li key={slot.key}>
                  <CreativeUpload
                    slot={slot}
                    value={draft.creatives[slot.key]}
                    error={errors[`creative-${slot.key}`]}
                    onChange={(c) => setCreative(slot.key, c)}
                  />
                </li>
              ))}
          </ul>
        )}
      </Section>

      <Section title="Segmentação" subtitle="Sem nada marcado, a campanha vale para o site todo.">
        <ChipGroup
          icon={<NewspaperIcon aria-hidden className="size-3.5" />}
          label="Editorias"
          options={categories}
          selected={draft.categories}
          onToggle={(slug) => update("categories", toggle(draft.categories, slug))}
        />
        <ChipGroup
          icon={<MapPinIcon aria-hidden className="size-3.5" />}
          label="Bairros"
          options={neighborhoods}
          selected={draft.neighborhoods}
          onToggle={(slug) => update("neighborhoods", toggle(draft.neighborhoods, slug))}
        />
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={adminRoutes.ads}
          className="mr-auto text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={() => save("draft")}
          disabled={busy}
          className="h-10 rounded-full px-4 text-sm font-semibold text-brand-blue hover:bg-brand-sky-light disabled:opacity-60"
        >
          Salvar rascunho
        </button>
        <button
          type="button"
          onClick={() => save("submit")}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-blue px-5 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {busy && <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />}
          Agendar campanha
        </button>
      </div>
    </div>
  );
}

/** Envio da peça de uma posição: lê o tamanho real da imagem e confere com os aceitos. */
function CreativeUpload({
  slot,
  value,
  error,
  onChange,
}: {
  slot: { key: AdSlotKey; label: string; sizes: AdSize[] };
  value: CampaignDraft["creatives"][AdSlotKey];
  error?: string;
  onChange: (value: CampaignDraft["creatives"][AdSlotKey]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fits = value ? sizeFits(value, slot.sizes) : false;

  function pick(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () =>
      onChange({ url, width: img.naturalWidth, height: img.naturalHeight, alt: value?.alt ?? "" });
    img.src = url;
  }

  return (
    <div
      id={`campo-creative-${slot.key}`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center",
        error && "border-destructive",
      )}
    >
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
        className="relative flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-dashed bg-muted/50 text-xs text-muted-foreground hover:border-brand-blue sm:w-48"
      >
        {value ? (
          // Prévia local do arquivo escolhido (ainda não enviado).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt="" className="size-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1">
            <ImagePlusIcon aria-hidden className="size-6 stroke-1" />
            Escolher imagem
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={`Peça para ${slot.label}`}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm font-semibold">
          {slot.label}{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            ({slot.sizes.map(formatSize).join(", ")})
          </span>
        </p>
        {value && (
          <p
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              fits ? "text-emerald-700" : "text-destructive",
            )}
          >
            {fits ? (
              <CheckCircle2Icon aria-hidden className="size-3.5" />
            ) : (
              <AlertCircleIcon aria-hidden className="size-3.5" />
            )}
            Imagem {formatSize(value)} {fits ? "— tamanho aceito" : "— tamanho não aceito"}
          </p>
        )}
        <label htmlFor={`alt-${slot.key}`} className="sr-only">
          Texto alternativo da peça
        </label>
        <input
          id={`alt-${slot.key}`}
          value={value?.alt ?? ""}
          disabled={!value}
          onChange={(e) => value && onChange({ ...value, alt: e.target.value })}
          placeholder="Descreva a peça (ex.: Pizza com 30% de desconto)"
          className={inputClass(undefined)}
        />
        {error && <FieldError>{error}</FieldError>}
      </div>
    </div>
  );
}

function ChipGroup({
  icon,
  label,
  options,
  selected,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        {icon} {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.slug);
          return (
            <button
              key={o.slug}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.slug)}
              className={cn(
                "rounded-full px-3 py-1 text-sm ring-1 transition",
                on
                  ? "bg-brand-blue text-white ring-brand-blue"
                  : "bg-background ring-border hover:ring-muted-foreground",
              )}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:p-5">
      <div>
        <h3 className="font-heading text-base font-bold">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`campo-${id}`} className="text-sm font-semibold">
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
