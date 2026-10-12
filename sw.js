/* SmartDrinkers — service worker : l'appli marche hors connexion une fois ouverte.
   VERSION est mise à jour automatiquement par « node outils/release.js ». */
const VERSION = "sd-v1.12.0";
const FILES = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "js/lib/qrcode.js", "js/lib/jsQR.js", "data/questions.js", "js/version.js",
  "js/i18n.js", "js/core.js", "js/quiz.js", "js/games.js", "js/games2.js", "js/share.js", "js/online.js", "js/online-games.js", "data/songs.js", "js/online-music.js", "js/main.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

// Installation : on télécharge tous les fichiers de cette version (sans passer par le cache HTTP)
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
});
// L'appli demande d'activer la nouvelle version quand le joueur appuie sur « Mettre à jour »
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && !k.startsWith("sd-fonts")).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Polices Google : gardées en cache entre les versions
  if (url.hostname.includes("fonts.g")) {
    e.respondWith(caches.open("sd-fonts").then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // Le numéro de version en ligne est toujours lu sur le réseau
  if (url.pathname.endsWith("/version.json")) { e.respondWith(fetch(req, { cache: "no-store" })); return; }
  // Fichiers de l'appli : ceux de la version installée, réseau en secours
  e.respondWith(caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))));
});
