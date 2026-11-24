const CACHE = "cuadra-shell-v1"

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest"])))
})

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url)
  if (evento.request.method !== "GET" || url.pathname.startsWith("/api")) return
  evento.respondWith(fetch(evento.request).catch(() => caches.match(evento.request)))
})
