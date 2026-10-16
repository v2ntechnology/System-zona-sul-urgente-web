"use client";

import { AlertCircleIcon, CheckCircle2Icon, EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { acceptInviteAction } from "@/app/admin/convite/[token]/actions";
import { adminRoutes } from "@/config/admin-navigation";
import { cn } from "@/lib/utils";

const PASSWORD_MIN = 10;

/** Criação da senha no aceite do convite (a API valida de novo). */
export function AcceptInviteForm({
  token,
  name,
  email,
}: {
  token: string;
  name: string;
  email: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < PASSWORD_MIN)
      return setError(`Use pelo menos ${PASSWORD_MIN} caracteres.`);
    if (password !== confirm) return setError("As duas senhas não são iguais.");
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteAction(token, password);
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <CheckCircle2Icon aria-hidden className="size-10 text-brand-blue" />
        <h1 className="font-heading text-2xl font-bold">Senha criada</h1>
        <p className="text-sm text-muted-foreground">
          Pronto, {name.split(" ")[0]}! Agora entre com <strong>{email}</strong> e a senha nova. Se
          o seu perfil pedir, o painel vai mostrar como ativar a verificação em duas etapas.
        </p>
        <Link
          href={adminRoutes.login}
          className="inline-flex h-11 items-center justify-center rounded-full bg-brand-red text-sm font-semibold text-white hover:bg-brand-red-dark"
        >
          Entrar no painel
        </Link>
      </div>
    );
  }

  const input =
    "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-brand-blue focus-visible:ring-3 focus-visible:ring-brand-blue/20";
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Boas-vindas, {name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie a senha de acesso ao painel para <strong>{email}</strong>.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="convite-senha" className="text-sm font-semibold">
          Nova senha
        </label>
        <div className="relative">
          <input
            id="convite-senha"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(input, "pr-11")}
            aria-describedby="convite-senha-dica"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Esconder senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {show ? (
              <EyeOffIcon aria-hidden className="size-4" />
            ) : (
              <EyeIcon aria-hidden className="size-4" />
            )}
          </button>
        </div>
        <p id="convite-senha-dica" className="text-xs text-muted-foreground">
          Pelo menos {PASSWORD_MIN} caracteres. Uma frase curta é mais fácil de lembrar.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="convite-confirma" className="text-sm font-semibold">
          Repita a senha
        </label>
        <input
          id="convite-confirma"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={input}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-full bg-brand-red text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar senha"}
      </button>
    </form>
  );
}
