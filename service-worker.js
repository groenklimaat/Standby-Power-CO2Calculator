/* =========================================================
   Service Worker — Standby Power & CO₂ Calculator
   Repository: groenklimaat/Standby-Power-CO2-Calculator
   Versie: 1.0.0
   ========================================================= */

const CACHE_NAME = 'standby-co2-v1.0.0';

/* ---------------------------------------------------------
   App-shell: alle bestanden die offline beschikbaar moeten zijn
   --------------------------------------------------------- */
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './privacy.html',
  './manifest.json',
  './icons/favicon.svg',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-300.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

/* ---------------- INSTALLATIE ---------------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Installatie gestart — versie', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(APP_SHELL).catch((err) => {
          console.warn('[SW] Sommige bestanden konden niet worden gecached:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

/* ---------------- ACTIVATIE ---------------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activatie gestart');
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[SW] Oude cache verwijderd:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------------- FETCH ---------------- */
/* Strategie:
   - Navigatie (HTML): network-first → fallback naar cache
   - Assets (CSS, JS, images): cache-first → fallback naar netwerk
*/
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Alleen GET-verzoeken cachen
  if (request.method !== 'GET') return;

  // Alleen same-origin verzoeken cachen
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ---- Navigatie: network-first ----
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // ---- Overige assets: cache-first ----
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== 'basic'
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          console.warn('[SW] Fetch mislukt voor:', request.url);
        });
    })
  );
});

/* ---------------- BERICHTEN ---------------- */
/* Sta toe dat de pagina de SW vraagt om direct te updaten */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
