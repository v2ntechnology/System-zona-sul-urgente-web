import { BrandLogo } from "@/components/brand/brand-logo";
import { MicMascot, type MascotMood } from "@/components/brand/mic-mascot";

// Páginas de erro/aviso com o mascote (inspiração: páginas 404 com personagem, pedido de
// 2026-11-11): número grande ao fundo, mascote na frente, céu nas cores da marca.
// O 404 aparece DENTRO do layout do site (cabeçalho e <main> já existem): standalone=false.
// O error.tsx da raiz substitui o layout inteiro: standalone=true traz <main> e a logo.
export function StatusPage({
  code,
  mood,
  title,
  description,
  children,
  standalone = false,
}: {
  /** Número grande ao fundo (ex.: "404"); só decorativo. */
  code?: string;
  mood: MascotMood;
  title: string;
  description: React.ReactNode;
  /** Ações (botões/links). */
  children?: React.ReactNode;
  standalone?: boolean;
}) {
  const Root = standalone ? "main" : "section";
  return (
    <Root
      {...(standalone ? { id: "conteudo" } : { "aria-labelledby": "status-title" })}
      className={
        standalone
          ? "relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden bg-linear-to-b from-brand-sky-light via-brand-sky-light to-background"
          : "relative isolate flex flex-col overflow-hidden bg-linear-to-b from-background via-brand-sky-light to-background py-8"
      }
    >
      {standalone && (
        <header className="px-4 py-4 sm:px-8 sm:py-6">
          <BrandLogo variant="light" className="text-xs sm:text-sm" />
        </header>
      )}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-4 pb-16 text-center">
        <div className="relative flex w-full justify-center">
          {code && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 font-heading text-[clamp(8rem,40vw,19rem)] leading-none font-black tracking-tighter text-background select-none [text-shadow:0_10px_40px_var(--mascot-shadow)]"
            >
              {code}
            </span>
          )}
          <MicMascot mood={mood} className="relative w-44 sm:w-60" />
        </div>
        <h1 id="status-title" className="font-heading text-display font-bold text-balance">
          {title}
        </h1>
        <p className="max-w-md text-pretty text-muted-foreground">{description}</p>
        {children && <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>}
      </div>
    </Root>
  );
}

/** Botão principal das páginas de status (link ou botão). */
export const statusAction =
  "inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-brand-blue-dark";
export const statusSecondaryAction =
  "inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-6 text-sm font-bold transition hover:border-brand-blue hover:text-brand-blue";
