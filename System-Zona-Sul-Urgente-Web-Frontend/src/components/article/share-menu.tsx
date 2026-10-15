"use client";

import { CheckIcon, LinkIcon, MessageCircleIcon, Share2Icon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const noopSubscribe = () => () => {};

/** Classe dos botões "pílula" do cabeçalho da matéria (Compartilhar, Adicionar ao Google). */
export const pillButton =
  "inline-flex h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm font-semibold transition hover:bg-accent hover:text-brand-blue motion-reduce:transition-none";

// Botão único "Compartilhar" (estilo CNN). No celular abre o compartilhamento nativo;
// onde não existe, um menu com WhatsApp, Facebook, X e copiar link.
export function ShareMenu({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => "share" in navigator && window.matchMedia("(pointer: coarse)").matches,
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

  if (canShare) {
    return (
      <button
        type="button"
        className={pillButton}
        onClick={() => navigator.share({ title, url }).catch(() => {})}
      >
        <Share2Icon className="size-4" aria-hidden />
        Compartilhar
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={pillButton}>
        <Share2Icon className="size-4" aria-hidden />
        Compartilhar
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-1.5">
        <DropdownMenuItem
          render={
            <a href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer" />
          }
          className="py-2"
        >
          <MessageCircleIcon aria-hidden className="text-whatsapp" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className="py-2"
        >
          <span aria-hidden className="w-4 text-center font-bold text-brand-blue">
            f
          </span>
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <a
              href={`https://x.com/intent/post?text=${text}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className="py-2"
        >
          <span aria-hidden className="w-4 text-center font-bold">
            𝕏
          </span>
          X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copy} closeOnClick={false} className="py-2">
          {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
          <span aria-live="polite">{copied ? "Link copiado" : "Copiar link"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
