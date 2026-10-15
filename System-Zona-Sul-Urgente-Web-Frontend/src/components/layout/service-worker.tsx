"use client";

import { useEffect } from "react";

// Registra o service worker (FE-115) só em produção: em desenvolvimento ele atrapalharia
// o recarregamento instantâneo.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sem service worker o site funciona normalmente; só perde a página offline.
    });
  }, []);
  return null;
}
