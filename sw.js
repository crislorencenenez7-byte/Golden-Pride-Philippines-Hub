/* ============================================================
   sw.js — Golden Pride Hub Service Worker
   Enables PWA installability and basic offline caching of the
   app shell (static files). Firebase calls always go to network.
   ============================================================ */

const CACHE_NAME = "golden-pride-hub-v1";

const APP_SHELL = [
  "index.html",
  "login.html",
  "register.html",
  "dashboard.html",
  "css/style.css",
  "css/auth.css",
  "css/dashboard.css",
  "css/responsive.css",
  "js/app.js",
  "js/firebase-config.js",
  "js/auth.js",
  "js/dashboard.js",
  "manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Never cache Firebase/Google API requests — always go live
  if (event.request.url.includes("firebaseio.com") ||
      event.request.url.includes("googleapis.com") ||
      event.request.url.includes("gstatic.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
