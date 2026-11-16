"use client";

import { KeyRoundIcon, Loader2Icon, LinkIcon, RefreshCwIcon, UnlinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  connectInstagram,
  disconnectInstagram,
  syncInstagramNow,
} from "@/app/admin/(painel)/instagram/actions";
import { RelativeTime } from "@/components/news/relative-time";
import { cn } from "@/lib/utils";
import type { InstagramConnection as Connection } from "@/types/admin";

const button =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-semibold transition hover:border-brand-blue hover:text-brand-blue disabled:pointer-events-none disabled:opacity-60";
const primaryButton =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-brand-blue-dark disabled:pointer-events-none disabled:opacity-70";
const field =
  "w-full rounded-md border bg-background px-3 text-sm font-normal outline-none focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/20";

// Conta do Instagram ligada ao painel (spec 001, História 1). Só para quem tem instagram.settings
// (Administrador): ligar, trocar e desligar. O acesso colado vai direto para a API e nunca é
// mostrado de volta — a tela só conhece os 4 últimos caracteres.
export function InstagramConnectionPanel({ connection }: { connection: Connection | null }) {
  const router = useRouter();
  // Sem conta ou com o acesso perdido, o formulário de ligar já abre aberto.
  const [editing, setEditing] = useState(connection === null || connection.status === "REVOKED");
  const [confirming, setConfirming] = useState(false);
  const [igUserId, setIgUserId] = useState(connection?.igUserId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await connectInstagram({ igUserId, accessToken });
      if (!result.ok && result.message === "simulated") {
        setNotice("Demonstração: sem a API, a conta não é ligada de verdade.");
        return;
      }
      if (!result.ok) {
        setErrors(result.errors ?? { form: result.message });
        return;
      }
      setAccessToken("");
      setErrors({});
      setEditing(false);
      setNotice(`Conta @${result.connection.username} ligada.`);
      router.refresh();
    });
  }

  function syncNow() {
    startTransition(async () => {
      const result = await syncInstagramNow();
      if (!result.ok && result.message === "simulated") {
        setNotice("Demonstração: sem a API, nada é sincronizado de verdade.");
        return;
      }
      setNotice(
        result.ok
          ? "Sincronização feita. Posts novos aparecem na fila e viram rascunho em instantes."
          : result.message,
      );
      router.refresh();
    });
  }

  function disconnect() {
    startTransition(async () => {
      const result = await disconnectInstagram();
      setConfirming(false);
      if (!result.ok && result.message === "simulated") {
        setNotice("Demonstração: sem a API, a conta não é desligada de verdade.");
        return;
      }
      if (!result.ok) {
        setNotice(result.message ?? "Não foi possível desligar a conta.");
        return;
      }
      setNotice("Conta desligada. A fila e as notícias continuam.");
      setEditing(true);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="conta-instagram"
      className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="conta-instagram" className="flex items-center gap-2 font-heading font-bold">
          <KeyRoundIcon aria-hidden className="size-4" /> Conta do Instagram
        </h2>
        {connection && !editing && (
          <div className="flex flex-wrap gap-2">
            {connection.status === "ACTIVE" && (
              <button type="button" className={button} onClick={syncNow} disabled={pending}>
                {pending ? (
                  <Loader2Icon aria-hidden className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCwIcon aria-hidden className="size-3.5" />
                )}
                Sincronizar agora
              </button>
            )}
            <button
              type="button"
              className={button}
              onClick={() => setEditing(true)}
              disabled={pending}
            >
              <LinkIcon aria-hidden className="size-3.5" /> Trocar conta ou acesso
            </button>
            {confirming ? (
              <>
                <button
                  type="button"
                  className={cn(button, "border-destructive text-destructive")}
                  onClick={disconnect}
                  disabled={pending}
                >
                  {pending && <Loader2Icon aria-hidden className="size-3.5 animate-spin" />}
                  Confirmar: desligar
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                className={button}
                onClick={() => setConfirming(true)}
                disabled={pending}
              >
                <UnlinkIcon aria-hidden className="size-3.5" /> Desligar
              </button>
            )}
          </div>
        )}
      </div>

      {connection && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Conta:</dt>
            <dd className="font-semibold">@{connection.username}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Ligada:</dt>
            <dd>
              <RelativeTime iso={connection.connectedAt} />
              {connection.connectedBy ? ` por ${connection.connectedBy}` : ""}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Acesso:</dt>
            <dd>
              …{connection.tokenLast4} ·{" "}
              {connection.tokenExpiresAt ? (
                <>
                  vence <RelativeTime iso={connection.tokenExpiresAt} />
                </>
              ) : (
                "não vence"
              )}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Última sincronização:</dt>
            <dd>
              {connection.lastSuccessAt ? (
                <RelativeTime iso={connection.lastSuccessAt} />
              ) : (
                "ainda não rodou"
              )}
            </dd>
          </div>
        </dl>
      )}

      {editing && (
        <form
          onSubmit={submit}
          className="flex flex-col gap-3"
          aria-label="Ligar conta do Instagram"
        >
          <p className="text-sm text-muted-foreground">
            No painel de desenvolvedor da Meta (app do painel → Casos de uso → API setup with
            Unified login), copie o <strong>ID da conta</strong> (os números ao lado do nome) e gere
            o <strong>acesso</strong> pelo botão “Gerar token”. O acesso fica guardado cifrado e não
            aparece de novo.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            ID da conta do Instagram
            <input
              inputMode="numeric"
              autoComplete="off"
              value={igUserId}
              onChange={(e) => setIgUserId(e.target.value)}
              placeholder="17841400000000000"
              className={cn(field, "h-10", errors.igUserId && "border-destructive")}
              disabled={pending}
              aria-invalid={Boolean(errors.igUserId)}
            />
            {errors.igUserId && (
              <span className="text-xs font-normal text-destructive">{errors.igUserId}</span>
            )}
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Acesso (token)
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Cole aqui o acesso gerado na Meta"
              className={cn(field, "h-10", errors.accessToken && "border-destructive")}
              disabled={pending}
              aria-invalid={Boolean(errors.accessToken)}
            />
            {errors.accessToken && (
              <span className="text-xs font-normal text-destructive">{errors.accessToken}</span>
            )}
          </label>
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className={primaryButton} disabled={pending}>
              {pending ? (
                <Loader2Icon aria-hidden className="size-3.5 animate-spin" />
              ) : (
                <LinkIcon aria-hidden className="size-3.5" />
              )}
              {connection ? "Trocar e conferir" : "Ligar conta"}
            </button>
            {connection && (
              <button
                type="button"
                className={button}
                onClick={() => setEditing(false)}
                disabled={pending}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  );
}
