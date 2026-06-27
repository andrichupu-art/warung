// KasirPro Service Worker — Network First + OneSignal Push
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'kasirpro-v1';
const STATIC_CACHE = 'kasirpro-static-v1';

// ====== INSTALL ======
self.addEventListener('install', (event) => {
  console.log('[SW] Installing KasirPro SW...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(['./index.html', './manifest.json']).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

// ====== ACTIVATE ======
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating KasirPro SW...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ====== FETCH — NETWORK FIRST ======
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase API — selalu network, jangan di-cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // OneSignal — biarkan SW OneSignal yang handle
  if (url.hostname.includes('onesignal.com')) return;

  // POST/PUT/DELETE — jangan di-cache
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // NETWORK FIRST untuk semua GET request
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (
              url.hostname === self.location.hostname ||
              url.hostname === 'cdn.tailwindcss.com' ||
              url.hostname === 'cdnjs.cloudflare.com' ||
              url.hostname === 'fonts.googleapis.com' ||
              url.hostname === 'fonts.gstatic.com' ||
              url.hostname === 'cdn.jsdelivr.net'
            ) {
              cache.put(event.request, responseClone).catch(() => {});
            }
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache (offline):', event.request.url);
            return cachedResponse;
          }
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return new Response(
              `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KasirPro - Offline</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f1f5f9; }
    .card { background: white; border-radius: 1.5rem; padding: 2.5rem; text-align: center; max-width: 320px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 3.5rem; margin-bottom: 1rem; }
    h2 { color: #0034D1; margin-bottom: 0.5rem; }
    p { color: #64748b; font-size: 0.9rem; line-height: 1.5; }
    button { margin-top: 1.5rem; background: #0034D1; color: white; border: none; padding: 0.75rem 2rem; border-radius: 0.75rem; font-size: 1rem; cursor: pointer; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📶</div>
    <h2>Tidak Ada Koneksi</h2>
    <p>KasirPro membutuhkan koneksi internet untuk mengakses data Supabase. Pastikan HP Anda terhubung ke internet.</p>
    <button onclick="location.reload()">Coba Lagi</button>
  </div>
</body>
</html>`,
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new Response('', { status: 408 });
        });
      })
  );
});

// ====== BACKGROUND SYNC ======
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transaksi') {
    console.log('[SW] Background sync: transaksi');
  }
});
