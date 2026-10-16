"use client";

import { AlertCircleIcon, MailIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { RelativeTime } from "@/components/news/relative-time";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatCnpj, isValidCnpj } from "@/lib/ads/validate";
import { cn } from "@/lib/utils";
import type { Advertiser } from "@/types/admin";

type FormState = {
  name: string;
  document: string;
  contactName: string;
  email: string;
  phone: string;
};
const emptyForm: FormState = { name: "", document: "", contactName: "", email: "", phone: "" };

function formatPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

// Anunciantes (FE-157): lista e cadastro. O CNPJ é conferido pelos dígitos verificadores.
// Sem backend, o cadastro só entra na tela (simulação).
export function AdvertisersView({ advertisers: initial }: { advertisers: Advertiser[] }) {
  const [advertisers, setAdvertisers] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [message, setMessage] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (form.name.trim().length < 2) found.name = "Informe o nome da empresa.";
    if (!isValidCnpj(form.document)) found.document = "CNPJ inválido (confira os números).";
    if (!form.contactName.trim()) found.contactName = "Informe quem é o contato.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) found.email = "E-mail inválido.";
    if (form.phone && form.phone.replace(/\D/g, "").length < 10)
      found.phone = "Telefone com DDD (10 ou 11 números).";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setAdvertisers((list) => [
      {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        document: form.document.replace(/\D/g, ""),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.replace(/\D/g, "") || undefined,
        activeCampaigns: 0,
        totalCampaigns: 0,
        createdAt: new Date().toISOString(),
      },
      ...list,
    ]);
    setMessage(`“${form.name.trim()}” cadastrado (simulação — sem backend conectado).`);
    setForm(emptyForm);
    setOpen(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {advertisers.length} anunciantes ·{" "}
          {advertisers.filter((a) => a.activeCampaigns > 0).length} com campanha no ar
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          <PlusIcon aria-hidden className="size-4" /> Novo anunciante
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

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {advertisers.map((a) => {
          const initials = a.name
            .split(" ")
            .filter((w) => w.length > 2)
            .map((w) => w[0])
            .slice(0, 2)
            .join("");
          return (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-sky-light font-heading text-sm font-bold text-brand-blue"
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    CNPJ {formatCnpj(a.document)}
                  </p>
                </div>
                {a.activeCampaigns > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    {a.activeCampaigns} no ar
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <p>{a.contactName}</p>
                <a
                  href={`mailto:${a.email}`}
                  className="inline-flex items-center gap-1.5 truncate text-brand-blue hover:underline"
                >
                  <MailIcon aria-hidden className="size-3.5 shrink-0" /> {a.email}
                </a>
                {a.phone && (
                  <a
                    href={`tel:+55${a.phone}`}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <PhoneIcon aria-hidden className="size-3.5" /> {formatPhone(a.phone)}
                  </a>
                )}
              </div>
              <p className="mt-auto border-t pt-3 text-xs text-muted-foreground">
                {a.totalCampaigns === 1 ? "1 campanha" : `${a.totalCampaigns} campanhas`} · cliente{" "}
                <RelativeTime iso={a.createdAt} />
              </p>
            </li>
          );
        })}
      </ul>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-5 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetTitle className="font-heading text-lg font-bold">Novo anunciante</SheetTitle>
          <SheetDescription>
            Dados da empresa e de quem fala com a redação comercial.
          </SheetDescription>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <TextField
              id="adv-name"
              label="Empresa"
              value={form.name}
              error={errors.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <TextField
              id="adv-document"
              label="CNPJ"
              value={formatCnpj(form.document)}
              error={errors.document}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              onChange={(v) => setForm({ ...form, document: v.replace(/\D/g, "") })}
            />
            <TextField
              id="adv-contact"
              label="Contato"
              value={form.contactName}
              error={errors.contactName}
              onChange={(v) => setForm({ ...form, contactName: v })}
            />
            <TextField
              id="adv-email"
              label="E-mail"
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
            <TextField
              id="adv-phone"
              label="Telefone (opcional)"
              inputMode="tel"
              value={formatPhone(form.phone)}
              error={errors.phone}
              placeholder="(21) 90000-0000"
              onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "") })}
            />
            <button
              type="submit"
              className="h-10 rounded-full bg-brand-blue text-sm font-semibold text-white hover:bg-brand-blue-dark"
            >
              Cadastrar
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  inputMode,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-erro` : undefined}
        className={cn(
          "h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
          error ? "border-destructive" : "border-input",
        )}
      />
      {error && (
        <p
          id={`${id}-erro`}
          className="flex items-center gap-1 text-xs font-medium text-destructive"
        >
          <AlertCircleIcon aria-hidden className="size-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
