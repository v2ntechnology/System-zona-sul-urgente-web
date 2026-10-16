"use client";

import {
  AlertCircleIcon,
  CopyIcon,
  LinkIcon,
  MoreHorizontalIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from "lucide-react";
import { useState, useTransition } from "react";

import type { ListResult } from "@/app/admin/(painel)/editorias/actions";
import {
  changeRoleAction,
  type InviteResult,
  inviteMemberAction,
  reinviteMemberAction,
  resetTwoFactorAction,
  setMemberActiveAction,
} from "@/app/admin/(painel)/equipe/actions";
import { RelativeTime } from "@/components/news/relative-time";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { roleDescriptions, roleLabels, TWO_FACTOR_ROLES } from "@/config/permissions";
import { accessChangeBlock, authorSlugFor, inviteErrors } from "@/lib/team/validate";
import { cn } from "@/lib/utils";
import type { Role, TeamMember } from "@/types/admin";

const ROLES: Role[] = ["ADMIN", "EDITOR", "REPORTER", "AUTOR", "COMERCIAL"];
const rolePlurals: Record<Role, string> = {
  ADMIN: "Administradores",
  EDITOR: "Editores",
  REPORTER: "Repórteres",
  COMERCIAL: "Comercial",
  AUTOR: "Autores/Colunistas",
};
const statusLabel = { ACTIVE: "Ativo", INVITED: "Convite enviado", DISABLED: "Desativado" };

type InviteForm = { name: string; email: string; role: Role | ""; createAuthor: boolean };
const emptyInvite: InviteForm = { name: "", email: "", role: "", createAuthor: true };

// Equipe (FE-159): quem acessa o painel, com qual perfil e se tem 2FA. Regras: ninguém
// altera o próprio acesso e sempre sobra um ADMIN ativo (a API garante de novo). Convite por
// link: ainda sem e-mail, o painel mostra o link para o administrador mandar à pessoa.
// Sem backend, tudo é simulado.
export function TeamManager({
  initial,
  currentUserId,
  authorSlugs,
}: {
  initial: TeamMember[];
  currentUserId: string;
  authorSlugs: string[];
}) {
  const [team, setTeam] = useState(initial);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState(emptyInvite);
  const [errors, setErrors] = useState<Partial<Record<keyof InviteForm, string>>>({});

  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const fail = (text: string) => setMessage({ tone: "error", text });

  /** Grava na API e usa a lista devolvida; sem API ("simulated"), simula na tela. */
  function persist(
    call: () => Promise<ListResult<TeamMember>>,
    simulate: () => void,
    text: string,
  ) {
    startTransition(async () => {
      const result = await call();
      if (result.ok) {
        setTeam(result.list);
        setMessage({ tone: "ok", text });
      } else if (result.message === "simulated") {
        simulate();
        setMessage({ tone: "ok", text: `${text} (simulação — sem backend conectado).` });
      } else fail(result.message);
    });
  }

  function showLink(result: Extract<InviteResult, { ok: true }>, name: string) {
    setTeam(result.list);
    setLink({ name, url: result.inviteUrl });
    setCopied(false);
    setMessage(null);
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url).catch(() => undefined);
    setCopied(true);
  }

  const counts = ROLES.map((role) => ({
    role,
    n: team.filter((m) => m.role === role && m.status !== "DISABLED").length,
  })).filter((c) => c.n > 0);
  const missing2fa = team.filter(
    (m) => m.status === "ACTIVE" && TWO_FACTOR_ROLES.has(m.role) && !m.twoFactor,
  );

  function changeRole(member: TeamMember, role: Role) {
    const block = accessChangeBlock(currentUserId, member, { role }, team);
    if (block) return fail(block);
    persist(
      () => changeRoleAction(member.id, role),
      () => setTeam((list) => list.map((m) => (m.id === member.id ? { ...m, role } : m))),
      `${member.name} agora é ${roleLabels[role]}${TWO_FACTOR_ROLES.has(role) && !member.twoFactor ? "; vai precisar ativar o 2FA no próximo acesso" : ""}`,
    );
  }

  function setDisabled(member: TeamMember, disable: boolean) {
    const block = accessChangeBlock(currentUserId, member, { disable }, team);
    if (disable && block) return fail(block);
    persist(
      () => setMemberActiveAction(member.id, !disable),
      () =>
        setTeam((list) =>
          list.map((m) =>
            m.id === member.id ? { ...m, status: disable ? "DISABLED" : "ACTIVE" } : m,
          ),
        ),
      disable
        ? `${member.name} perdeu o acesso; as matérias assinadas continuam no ar`
        : `${member.name} voltou a ter acesso`,
    );
  }

  function reset2fa(member: TeamMember) {
    persist(
      () => resetTwoFactorAction(member.id),
      () =>
        setTeam((list) => list.map((m) => (m.id === member.id ? { ...m, twoFactor: false } : m))),
      `2FA de ${member.name} zerado: configura de novo no próximo acesso`,
    );
  }

  function reinvite(member: TeamMember) {
    startTransition(async () => {
      const result = await reinviteMemberAction(member.id);
      if (result.ok) showLink(result, member.name);
      else if (result.message === "simulated")
        setMessage({
          tone: "ok",
          text: `Novo link de convite para ${member.name} (simulação — sem backend conectado).`,
        });
      else fail(result.message);
    });
  }

  function invite(event: React.FormEvent) {
    event.preventDefault();
    const found = inviteErrors(form, team);
    setErrors(found);
    if (Object.keys(found).length > 0 || !form.role) return;
    const authorSlug =
      form.createAuthor && form.role !== "COMERCIAL"
        ? authorSlugFor(form.name, authorSlugs)
        : undefined;
    const input = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role as Role,
      createAuthor: form.createAuthor,
    };
    startTransition(async () => {
      const result = await inviteMemberAction(input);
      if (result.ok) {
        showLink(result, input.name);
      } else if (result.message === "simulated") {
        setTeam((list) => [
          ...list,
          {
            id: crypto.randomUUID(),
            ...input,
            status: "INVITED",
            twoFactor: false,
            invitedAt: new Date().toISOString(),
            authorSlug,
          },
        ]);
        setMessage({
          tone: "ok",
          text: `Convite criado para ${input.email}${authorSlug ? `; autor “${input.name}” criado (/autor/${authorSlug})` : ""} (simulação — sem backend conectado).`,
        });
      } else {
        if (result.errors) setErrors(result.errors);
        return fail(result.message);
      }
      setForm(emptyInvite);
      setInviting(false);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-2 text-sm">
          {counts.map(({ role, n }) => (
            <li key={role} className="rounded-full bg-background px-3 py-1 ring-1 ring-border">
              <strong className="font-semibold">{n}</strong>{" "}
              {n > 1 ? rolePlurals[role] : roleLabels[role]}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            setErrors({});
            setInviting(true);
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          <UserPlusIcon aria-hidden className="size-4" /> Convidar pessoa
        </button>
      </div>

      {missing2fa.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {missing2fa.map((m) => m.name).join(", ")}{" "}
            {missing2fa.length > 1 ? "ainda não ativaram" : "ainda não ativou"} a verificação em
            duas etapas, obrigatória para{" "}
            {[...TWO_FACTOR_ROLES].map((r) => roleLabels[r]).join(", ")}. O acesso fica bloqueado
            até ativar.
          </span>
        </p>
      )}

      {link && (
        <section
          aria-labelledby="link-convite"
          className="flex flex-col gap-3 rounded-xl border border-brand-blue/30 bg-brand-sky-light p-4"
        >
          <h2
            id="link-convite"
            className="flex items-center gap-2 text-sm font-semibold text-brand-blue"
          >
            <LinkIcon aria-hidden className="size-4" /> Convite de {link.name} criado
          </h2>
          <p className="text-sm">
            Mande este link para a pessoa (WhatsApp, por exemplo). Ela cria a senha por ele. O link
            vale 7 dias e funciona uma vez só; ele não aparece de novo aqui depois que você sair.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={link.url}
              aria-label="Link do convite"
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-xs"
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-dark"
            >
              <CopyIcon aria-hidden className="size-4" /> {copied ? "Copiado" : "Copiar link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Seu acesso ao painel do Zona Sul Urgente: ${link.url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-brand-blue bg-background px-4 text-sm font-semibold text-brand-blue hover:bg-brand-sky-light"
            >
              Mandar no WhatsApp
            </a>
          </div>
          <button
            type="button"
            onClick={() => setLink(null)}
            className="self-start text-xs font-semibold text-brand-blue hover:underline"
          >
            Já mandei, fechar
          </button>
        </section>
      )}

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
            message.tone === "ok" ? "bg-brand-sky-light text-brand-blue" : "bg-red-50 text-red-800",
          )}
        >
          {message.tone === "error" && <AlertCircleIcon aria-hidden className="size-4" />}
          {message.text}
        </p>
      )}

      <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-background shadow-xs">
        {team.map((member) => {
          const self = member.id === currentUserId;
          const needs2fa = TWO_FACTOR_ROLES.has(member.role);
          const initials = member.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("");
          return (
            <li
              key={member.id}
              className={cn(
                "grid items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.5fr)_10rem_minmax(0,1fr)_auto]",
                member.status === "DISABLED" && "opacity-60",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white"
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {member.name}
                    {self && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (você)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>

              <div>
                <label htmlFor={`role-${member.id}`} className="sr-only">
                  Perfil de {member.name}
                </label>
                <select
                  id={`role-${member.id}`}
                  value={member.role}
                  disabled={self || member.status === "DISABLED"}
                  title={self ? "Você não pode alterar o seu próprio acesso." : undefined}
                  onChange={(e) => changeRole(member, e.target.value as Role)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm disabled:opacity-70"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                    member.status === "ACTIVE" && "bg-emerald-50 text-emerald-800",
                    member.status === "INVITED" && "bg-brand-sky-light text-brand-blue",
                    member.status === "DISABLED" && "bg-muted text-muted-foreground",
                  )}
                >
                  {statusLabel[member.status]}
                </span>
                {member.status !== "DISABLED" &&
                  (member.twoFactor ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <ShieldCheckIcon aria-hidden className="size-3.5" /> 2FA ativo
                    </span>
                  ) : needs2fa ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                      <ShieldAlertIcon aria-hidden className="size-3.5" /> 2FA pendente
                    </span>
                  ) : (
                    <span className="text-muted-foreground">2FA opcional</span>
                  ))}
                <span className="text-muted-foreground">
                  {member.status === "INVITED" && member.invitedAt ? (
                    <>
                      convidado <RelativeTime iso={member.invitedAt} />
                    </>
                  ) : member.lastLoginAt ? (
                    <>
                      acesso <RelativeTime iso={member.lastLoginAt} />
                    </>
                  ) : null}
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Ações para ${member.name}`}
                  disabled={self}
                  className="inline-flex size-8 items-center justify-center justify-self-end rounded-md hover:bg-muted disabled:opacity-30"
                >
                  <MoreHorizontalIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {member.status === "INVITED" && (
                    <DropdownMenuItem onClick={() => reinvite(member)}>
                      Gerar novo link de convite
                    </DropdownMenuItem>
                  )}
                  {member.status === "ACTIVE" && member.twoFactor && (
                    <DropdownMenuItem onClick={() => reset2fa(member)}>
                      Zerar 2FA (perdeu o celular)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {member.status === "DISABLED" ? (
                    <DropdownMenuItem onClick={() => setDisabled(member, false)}>
                      Reativar acesso
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDisabled(member, true)}
                    >
                      {member.status === "INVITED" ? "Cancelar convite" : "Desativar acesso"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      <Sheet open={inviting} onOpenChange={setInviting}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-5 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetTitle className="font-heading text-lg font-bold">Convidar pessoa</SheetTitle>
          <SheetDescription>
            Você recebe um link para mandar à pessoa; por ele, ela cria a senha
            {form.role && TWO_FACTOR_ROLES.has(form.role)
              ? " e, no primeiro acesso, ativa a verificação em duas etapas"
              : ""}
            .
          </SheetDescription>
          <form onSubmit={invite} noValidate className="flex flex-col gap-4">
            <Field id="inv-name" label="Nome completo" error={errors.name}>
              <input
                id="inv-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass(errors.name)}
                autoFocus
              />
            </Field>
            <Field id="inv-email" label="E-mail" error={errors.email}>
              <input
                id="inv-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nome@zonasulurgente.com.br"
                className={inputClass(errors.email)}
              />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Perfil de acesso</legend>
              {ROLES.map((role) => (
                <label
                  key={role}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                    form.role === role
                      ? "border-brand-blue bg-brand-sky-light"
                      : "hover:border-muted-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="inv-role"
                    checked={form.role === role}
                    onChange={() =>
                      setForm({
                        ...form,
                        role,
                        createAuthor: role !== "COMERCIAL" && form.createAuthor,
                      })
                    }
                    className="mt-0.5 size-4 accent-brand-blue"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">
                      {roleLabels[role]}
                      {TWO_FACTOR_ROLES.has(role) && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          · exige 2FA
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{roleDescriptions[role]}</span>
                  </span>
                </label>
              ))}
              {errors.role && <FieldError>{errors.role}</FieldError>}
            </fieldset>
            {form.role !== "COMERCIAL" && (
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.createAuthor}
                  onChange={(e) => setForm({ ...form, createAuthor: e.target.checked })}
                  className="mt-0.5 size-4 accent-brand-blue"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">Criar o perfil de autor junto</span>
                  <span className="text-xs text-muted-foreground">
                    Para assinar matérias. Já aparece no editor de notícias.
                  </span>
                </span>
              </label>
            )}
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
              {pending ? "Criando…" : "Criar convite"}
            </button>
          </form>
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
    "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
    error ? "border-destructive" : "border-input",
  );
}
