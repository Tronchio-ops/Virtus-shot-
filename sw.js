const CACHE = "virtus-shot-tracker-cache-v1";
const ASSETS = [
  "/virtus-shot-tracker/",
  "/virtus-shot-tracker/index.html",
  "/virtus-shot-tracker/app.js",
  "/virtus-shot-tracker/manifest.webmanifest",
  "/virtus-shot-tracker/bg.png",
  "/virtus-shot-tracker/icon-192.png",
  "/virtus-shot-tracker/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
