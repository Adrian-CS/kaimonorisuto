// Service worker mínimo: solo notificaciones, nada de caché offline.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "🥕", {
      body: data.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      lang: data.lang || "es",
      // Un tag por artículo: con uno fijo, cada aviso borraba al anterior.
      tag: data.tag || "lista-compra",
      renotify: true,
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.startsWith(self.location.origin) && "focus" in client)
            return client.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
