"use client";

import {
  AlertCircleIcon,
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  MailIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { adminRoutes } from "@/config/admin-navigation";
import { cn } from "@/lib/utils";

type Step = "credentials" | "code" | "forgot" | "sent";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIMULATED_DELAY = 600;

// Formulário de login (só interface; BE-006 faz a autenticação). Dois passos: e-mail e
// senha, depois o código de 6 dígitos do app autenticador — obrigatório para ADMIN,
// EDITOR e COMERCIAL (ARCHITECTURE §8). Mensagens de erro nunca dizem se o e-mail existe.
export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  function wait(then: () => void) {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      then();
    }, SIMULATED_DELAY);
  }

  function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("Informe um e-mail válido.");
    if (password.length < 8) return setError("A senha tem pelo menos 8 caracteres.");
    setError(null);
    wait(() => {
      setStep("code");
      requestAnimationFrame(() => codeRef.current?.focus());
    });
  }

  function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Digite os 6 números do app autenticador.");
    setError(null);
    wait(() => router.push(adminRoutes.dashboard));
  }

  function submitForgot(event: React.FormEvent) {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("Informe um e-mail válido.");
    setError(null);
    wait(() => setStep("sent"));
  }

  const back = (to: Step) => () => {
    setError(null);
    setStep(to);
  };

  return (
    <div className="flex flex-col gap-6">
      {step === "credentials" && (
        <form onSubmit={submitCredentials} noValidate className="flex flex-col gap-5">
          <Heading title="Entrar no painel" subtitle="Acesso restrito à equipe da redação." />
          <ErrorMessage error={error} />
          <Field label="E-mail" htmlFor="login-email">
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error) && !EMAIL.test(email.trim())}
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label="Senha" htmlFor="login-password">
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(inputClass, "pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                className="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
          </Field>
          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="lembrar" className="size-4 accent-brand-blue" />
              Lembrar por 15 dias
            </label>
            <button
              type="button"
              onClick={back("forgot")}
              className="font-semibold text-brand-blue hover:underline"
            >
              Esqueci a senha
            </button>
          </div>
          <Submit busy={busy}>Entrar</Submit>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} noValidate className="flex flex-col gap-5">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-sky-light text-brand-blue">
            <ShieldCheckIcon aria-hidden className="size-6" />
          </span>
          <Heading
            title="Verificação em duas etapas"
            subtitle={`Abra o app autenticador e digite o código de 6 números da conta ${email.trim()}.`}
          />
          <ErrorMessage error={error} />
          <Field label="Código" htmlFor="login-code">
            <input
              ref={codeRef}
              id="login-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className={cn(inputClass, "text-center font-mono text-2xl tracking-[0.5em]")}
            />
          </Field>
          <Submit busy={busy}>Confirmar</Submit>
          <BackButton onClick={back("credentials")}>Voltar</BackButton>
        </form>
      )}

      {step === "forgot" && (
        <form onSubmit={submitForgot} noValidate className="flex flex-col gap-5">
          <Heading
            title="Recuperar acesso"
            subtitle="Vamos mandar um link para você criar uma nova senha. Ele vale por 30 minutos."
          />
          <ErrorMessage error={error} />
          <Field label="E-mail" htmlFor="forgot-email">
            <input
              id="forgot-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </Field>
          <Submit busy={busy}>Enviar link</Submit>
          <BackButton onClick={back("credentials")}>Voltar para o login</BackButton>
        </form>
      )}

      {step === "sent" && (
        <div role="status" className="flex flex-col gap-5">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <MailIcon aria-hidden className="size-6" />
          </span>
          {/* Mesma resposta exista ou não a conta: não revela quem é da equipe. */}
          <Heading
            title="Confira seu e-mail"
            subtitle={`Se ${email.trim()} for de alguém da equipe, o link para criar uma nova senha chega em instantes.`}
          />
          <BackButton onClick={back("credentials")}>Voltar para o login</BackButton>
        </div>
      )}

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Simulação: sem backend conectado (BE-006), qualquer e-mail e senha de 8+ caracteres e
        qualquer código de 6 números entram no painel.
      </p>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive";

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="font-heading text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorMessage({ error }: { error: string | null }) {
  return (
    <p
      role="alert"
      className={cn(
        "items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800",
        error ? "flex" : "hidden",
      )}
    >
      <AlertCircleIcon aria-hidden className="size-4 shrink-0" />
      {error}
    </p>
  );
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-sm font-semibold text-white shadow-md transition hover:bg-brand-red-dark disabled:opacity-70"
    >
      {busy && <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon aria-hidden className="size-4" /> {children}
    </button>
  );
}
