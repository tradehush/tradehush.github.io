// Offline cache for the game: everything is cached on install, then served cache-first.
// Bump V when any file changes so phones pick up the new version.
const V = "blackpine-5";
const FILES = ["./", "index.html", "style.css", "manifest.webmanifest", "vendor/three.min.js",
  "js/data.js", "js/audio.js", "js/world.js", "js/game.js", "js/life.js", "js/voice.js", "js/scene3d.js", "js/hud.js", "js/ui.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("blackpine-") && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
