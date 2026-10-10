/* SmartDrinkers — service worker : l'appli marche hors connexion une fois ouverte.
   Change VERSION à chaque mise à jour pour que les téléphones récupèrent les nouveaux fichiers. */
const VERSION = "sd-v1.2.0";
const FILES = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "js/lib/qrcode.js", "js/lib/jsQR.js", "data/questions.js",
  "js/i18n.js", "js/core.js", "js/quiz.js", "js/games.js", "js/share.js", "js/main.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Polices Google : mises en cache au premier passage
  if (url.hostname.includes("fonts.g")) {
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // Fichiers de l'appli : cache d'abord, mise à jour en arrière-plan
  e.respondWith(caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
