// Offline cache. The page and settings are network-first so updates arrive at once;
// history data, the OCR engine and icons are cache-first. Supabase and Telegram are never cached.
const V = "sb-muypuwo1";
const SHELL = ["./", "en", "boot.js", "config.js", "manifest.webmanifest", "app.ca7a2d0340.bin", "shell.e66e565381.js", "app-en.c6c58c462b.bin", "shell-en.517c65b1b7.js", "lib/supabase.js", "lib/fonts/inter.css", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const longLived = /\/(data|vendor|icons|lib)\//.test(url.pathname) || /\/(app|shell)(-en)?\.[0-9a-f]{10}\.(js|bin)$/.test(url.pathname);
  if (longLived) {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && !res.redirected) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok && !res.redirected) caches.open(V).then(c => c.put(req, res.clone()));
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match("./"))));
});
