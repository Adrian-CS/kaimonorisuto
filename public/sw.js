// Service worker: notificaciones y uso sin conexión.
//
// Sin conexión, la app tiene que poder abrirse y enseñar la lista. Para eso
// se guardan tres cosas en la Cache API (los datos de la lista y los cambios
// pendientes van aparte, en localStorage, ver lib/outbox.ts):
//
// - páginas  (/ y /login): red primero; sin red, la última copia.
// - estáticos (/_next/static, iconos): llevan hash en el nombre y no cambian,
//   así que caché primero. Se recorta para que no crezca con cada despliegue.
// - fotos    (/api/photos/…): la clave es única por foto y no cambia nunca,
//   así que también caché primero. Así en el súper se ven sin cobertura.
//
// Las llamadas a /api que no son fotos no pasan por aquí: la app ya sabe
// qué hacer cuando fallan.

const PAGES = "lista-paginas";
const STATIC = "lista-estaticos";
const PHOTOS = "lista-fotos";
const MAX_STATIC = 300;
const MAX_PHOTOS = 500;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req));
  } else if (url.pathname.startsWith("/api/photos/")) {
    event.respondWith(cacheFirst(req, PHOTOS, MAX_PHOTOS));
  } else if (isStatic(url.pathname)) {
    event.respondWith(cacheFirst(req, STATIC, MAX_STATIC));
  }
});

function isStatic(path) {
  return (
    path.startsWith("/_next/static/") ||
    path === "/manifest.webmanifest" ||
    /\.(svg|png|ico|webp|woff2?)$/.test(path)
  );
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGES);
  const key = new URL(req.url).pathname; // sin query: una copia por página
  try {
    const res = await fetch(req);
    // Una redirección (p. ej. a /login sin sesión) no es la página pedida.
    if (res.ok && !res.redirected) await cache.put(key, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(key)) ||
      (await cache.match("/")) ||
      (await cache.match("/login")) ||
      new Response("Sin conexión", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(req, name, max) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    void trim(cache, max);
  }
  return res;
}

// Borra las entradas más antiguas (la Cache API las da por orden de alta).
async function trim(cache, max) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
}

// La primera vez, la página se carga antes de que el service worker la
// controle, así que sus ficheros no pasan por el fetch de arriba. La app nos
// manda la lista de lo que ya cargó y lo guardamos.
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "precache" || !Array.isArray(msg.urls)) return;
  event.waitUntil(
    (async () => {
      for (const raw of msg.urls) {
        try {
          const url = new URL(raw, self.location.origin);
          if (url.origin !== self.location.origin) continue;
          if (url.pathname === "/" || url.pathname === "/login") {
            // Solo si aún no hay copia: luego la mantiene al día el fetch de
            // navegación, sin pedir la página dos veces en cada visita.
            const c = await caches.open(PAGES);
            if (await c.match(url.pathname)) continue;
            const res = await fetch(url.pathname, { credentials: "same-origin" });
            if (res.ok && !res.redirected) await c.put(url.pathname, res);
          } else if (url.pathname.startsWith("/api/photos/")) {
            const c = await caches.open(PHOTOS);
            if (!(await c.match(url.href))) await c.add(url.href);
          } else if (isStatic(url.pathname)) {
            const c = await caches.open(STATIC);
            if (!(await c.match(url.href))) await c.add(url.href);
          }
        } catch {
          /* sin red o recurso que ya no existe: no pasa nada */
        }
      }
    })(),
  );
});

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
