"use client";

import { CheckIcon, LinkIcon, MessageCircleIcon, Share2Icon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

type ShareButtonsProps = { url: string; title: string; className?: string };

const noopSubscribe = () => () => {};

// Compartilhamento (FE-110). Sempre com a URL canônica. WhatsApp primeiro: é o canal
// principal do público. "Compartilhar" nativo só aparece onde o navegador suporta.
export function ShareButtons({ url, title, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  // No servidor é sempre false; no navegador, true onde existe Web Share API.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => "share" in navigator,
    () => false,
  );

  const text = encodeURIComponent(`${title} ${url}`);
  const encodedUrl = encodeURIComponent(url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // Usuário cancelou: nada a fazer.
    }
  }

  const button =
    "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition hover:-translate-y-px hover:shadow-sm motion-reduce:transition-none";

  return (
    <div
      role="group"
      aria-label="Compartilhar"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <a
        href={`https://wa.me/?text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(button, "border-whatsapp bg-whatsapp text-white")}
      >
        <MessageCircleIcon className="size-4" aria-hidden />
        WhatsApp
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(button, "hover:border-brand-blue hover:text-brand-blue")}
      >
        Facebook
      </a>
      <button
        type="button"
        onClick={copy}
        className={cn(button, "hover:border-brand-blue hover:text-brand-blue")}
      >
        {copied ? (
          <CheckIcon className="size-4" aria-hidden />
        ) : (
          <LinkIcon className="size-4" aria-hidden />
        )}
        <span aria-live="polite">{copied ? "Link copiado" : "Copiar link"}</span>
      </button>
      {canShare && (
        <button
          type="button"
          onClick={nativeShare}
          className={cn(button, "hover:border-brand-blue hover:text-brand-blue")}
        >
          <Share2Icon className="size-4" aria-hidden />
          Compartilhar
        </button>
      )}
    </div>
  );
}
