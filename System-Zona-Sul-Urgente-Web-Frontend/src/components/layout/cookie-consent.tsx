"use client";

import Link from "next/link";
import Script from "next/script";
import { Suspense, use, useEffect, useState } from "react";
import { browser } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  adsAllowed,
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  consentCookie,
  parseConsent,
  type ConsentChoice,
} from "@/lib/consent";

/** ID do editor no AdSense (ca-pub-...). Vazio = AdSense desligado, mesmo com aceite. */
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

// Aviso de cookies (FE-122). Roda só no navegador (use(browser())): a página continua estática
// e quem não executa JavaScript (robôs) não vê o aviso. Fica fixo no rodapé sem bloquear a
// leitura. Também carrega o AdSense — só depois do "Aceitar" (é isso que cumpre a LGPD aqui;
// se um dia o site atender o público europeu, trocar por uma CMP certificada pelo Google).
export function CookieConsent() {
  return (
    <Suspense fallback={null}>
      <ConsentManager />
    </Suspense>
  );
}

function ConsentManager() {
  use(browser("A escolha de cookies fica num cookie lido no navegador."));
  const [choice, setChoice] = useState<ConsentChoice | null>(() => parseConsent(document.cookie));
  const [open, setOpen] = useState(choice === null);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  function decide(next: ConsentChoice) {
    document.cookie = consentCookie(next, location.protocol === "https:");
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: next }));
    setOpen(false);
    // Script de publicidade já carregado não tem como "descarregar": recarrega sem ele.
    if (adsAllowed(choice) && !adsAllowed(next)) location.reload();
    setChoice(next);
  }

  return (
    <>
      {adsAllowed(choice) && ADSENSE_CLIENT && (
        <Script
          id="adsense"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}
      {open && (
        <section
          aria-label="Aviso de cookies"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border bg-background p-4 shadow-lg sm:flex-row sm:items-center sm:gap-5"
        >
          <p className="text-sm text-muted-foreground">
            Usamos cookies essenciais para o site funcionar. Com a sua permissão, também usamos
            cookies de publicidade, que ajudam a manter o jornalismo local gratuito.{" "}
            <Link
              href="/privacidade"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              Política de privacidade
            </Link>
            .
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => decide("essential")}>
              Recusar
            </Button>
            <Button onClick={() => decide("all")}>Aceitar</Button>
          </div>
        </section>
      )}
    </>
  );
}

/** "Preferências de cookies" no rodapé: reabre o aviso para mudar a escolha. */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
    >
      Preferências de cookies
    </button>
  );
}
