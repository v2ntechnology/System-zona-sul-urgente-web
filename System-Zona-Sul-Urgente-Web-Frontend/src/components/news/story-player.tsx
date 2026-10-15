"use client";

import { XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Abre os Web Stories dentro do site com o player oficial do AMP (amp-story-player), como a
// CNN faz: botão fechar, setas e arrastar entre stories. Os cards continuam sendo links
// <a href="/stories/..."> (Google e leitores sem JavaScript abrem a página AMP direto).
// API: github.com/ampproject/amphtml/blob/main/docs/spec/amp-story-player.md

const PLAYER_JS = "https://cdn.ampproject.org/amp-story-player-v0.js";
const PLAYER_CSS = "https://cdn.ampproject.org/amp-story-player-v0.css";

type PlayerElement = HTMLElement & {
  load: () => void;
  show: (url: string | null, pageId?: string | null, options?: { animate?: boolean }) => void;
  isReady?: boolean;
};

declare global {
  interface Window {
    AmpStoryPlayer?: new (win: Window, element: HTMLElement) => unknown;
  }
}

let playerScript: Promise<void> | null = null;

function loadPlayerAssets(): Promise<void> {
  if (window.AmpStoryPlayer) return Promise.resolve();
  playerScript ??= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = PLAYER_CSS;
    document.head.append(css);
    const script = document.createElement("script");
    script.src = PLAYER_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      playerScript = null;
      reject(new Error("Falha ao carregar o player de stories"));
    };
    document.head.append(script);
  });
  return playerScript;
}

type StoryPlayerProps = {
  stories: { url: string; title: string }[];
  children: React.ReactNode;
};

export function StoryPlayer({ stories, children }: StoryPlayerProps) {
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpenUrl(null);
    triggerRef.current?.focus();
  }, []);

  // Intercepta o clique nos cards (links com data-story-url) e abre no player.
  function onClickCapture(event: React.MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    )
      return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-story-url]");
    if (!link) return;
    event.preventDefault();
    triggerRef.current = link;
    setOpenUrl(link.dataset.storyUrl ?? null);
  }

  useEffect(() => {
    if (!openUrl) return;
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);

    loadPlayerAssets()
      .then(() => {
        if (cancelled || !window.AmpStoryPlayer) return;
        const player = document.createElement("amp-story-player") as PlayerElement;
        player.style.width = "100%";
        player.style.height = "100%";
        const config = document.createElement("script");
        config.type = "application/json";
        config.textContent = JSON.stringify({
          controls: [{ name: "close", position: "start" }, { name: "skip-to-next" }],
        });
        player.append(config);
        for (const story of stories) {
          const a = document.createElement("a");
          a.href = story.url;
          a.textContent = story.title;
          player.append(a);
        }
        new window.AmpStoryPlayer(window, player);
        mount.append(player);
        player.load();
        player.addEventListener("amp-story-player-close", close);
        // O player identifica cada story pela URL absoluta do <a> (a.href).
        const target = new URL(openUrl, window.location.href).href;
        const showClicked = () => player.show(target, null, { animate: false });
        if (player.isReady) showClicked();
        else player.addEventListener("ready", showClicked, { once: true });
      })
      .catch(() => {
        // Sem o player (bloqueado/offline): abre a página AMP da story normalmente.
        if (!cancelled) window.location.href = openUrl;
      });

    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      mount.replaceChildren();
    };
  }, [openUrl, stories, close]);

  return (
    <div onClickCapture={onClickCapture}>
      {children}
      {openUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Webstory"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={(event) => event.target === event.currentTarget && close()}
        >
          <div
            ref={mountRef}
            className="h-full w-full sm:h-[min(90vh,800px)] sm:w-[calc(min(90vh,800px)*9/16)] sm:overflow-hidden sm:rounded-xl"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Fechar webstory"
            className="absolute top-4 right-4 hidden size-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:flex"
            autoFocus
          >
            <XIcon aria-hidden className="size-6" />
          </button>
        </div>
      )}
    </div>
  );
}
