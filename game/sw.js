// Offline cache for the game. Online, files come from the network so updates show up at once;
// offline, the last cached copy is used. Bump V when the file list changes.
const V = "blackpine-14";
const FILES = ["./", "index.html", "style.css", "manifest.webmanifest", "vendor/three.min.js",
  "js/data.js", "js/audio.js", "js/world.js", "js/game.js", "js/life.js", "js/home.js", "js/boss.js", "js/net.js", "vendor/peerjs.min.js", "js/voice.js", "js/scene3d.js", "js/hud.js", "js/ui.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("blackpine-") && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/version.json")) return; // always straight from the site
  // the big library rarely changes: cache first; everything else: network first
  if (url.pathname.endsWith("/vendor/three.min.js")) { e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))); return; }
  e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
