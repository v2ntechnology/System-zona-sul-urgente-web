// Service worker do Zona Sul Urgente (FE-115).
// Escopo DELIBERADAMENTE pequeno: só a página offline. Não guarda notícias em cache —
// em portal de notícias, cache no aparelho mostra conteúdo velho; quem faz cache é a CDN.
// Também é a base das notificações push de urgentes (FE-1xx / BE push).

const VERSION = "v1";
const CACHE = `zsu-offline-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("zsu-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Só navegações de página: rede primeiro; sem rede, a página offline.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
  );
});

// --- Push (preparado; o envio entra com o backend) ---------------------------------
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      tag: data.tag, // mesma notícia atualizada substitui a notificação anterior
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin);
  // Só abre páginas do próprio site.
  if (url.origin !== self.location.origin) return;
  event.waitUntil(self.clients.openWindow(url.href));
});
