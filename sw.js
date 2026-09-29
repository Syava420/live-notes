// Service Worker для офлайн-работы блокнота (PWA)
const CACHE_NAME = "notes-cache-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icon.svg",
  "./js/config.js",
  "./js/router.js",
  "./js/folders.js",
  "./js/checklist.js",
  "./js/editor.js",
  "./js/gestures.js",
  "./js/main.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Не кэшируем сетевые запросы к Google Firestore API, отдаем свежие данные
  if (e.request.url.includes("firestore.googleapis.com") || e.request.url.includes("firebase")) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
