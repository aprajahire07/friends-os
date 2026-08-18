/**
 * FRIEND OS — Progressive Web App Service Worker
 * 
 * STRICT CACHING POLICY:
 * - Caches ONLY static application assets (HTML shell, JS, CSS, fonts, app icons).
 * - NEVER caches Supabase API calls (Auth, REST, Storage, Realtime, WebSockets).
 * - NEVER caches sensitive credentials, passwords, or user-specific records.
 * - Uses Network-First for navigation so new deployments are served immediately.
 */

const CACHE_NAME = 'friend-os-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

// URLs/patterns that must NEVER be cached or intercepted by Service Worker
function isDynamicOrExcluded(url) {
  const urlStr = url.href.toLowerCase();
  
  // Supabase endpoints & WebSockets
  if (
    urlStr.includes('supabase.co') ||
    urlStr.includes('/rest/v1/') ||
    urlStr.includes('/auth/v1/') ||
    urlStr.includes('/storage/v1/') ||
    urlStr.includes('/realtime/v1/') ||
    urlStr.startsWith('wss:') ||
    urlStr.startsWith('ws:')
  ) {
    return true;
  }

  // Internal API endpoints
  if (url.pathname.startsWith('/api/')) {
    return true;
  }

  // Dicebear avatars & external user-generated uploads
  if (url.hostname.includes('dicebear.com') || url.hostname.includes('images.unsplash.com')) {
    return true;
  }

  return false;
}

// Install Event — Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA Pre-cache item note:', err);
      });
    })
  );
  // Auto-activate new worker immediately
  self.skipWaiting();
});

// Activate Event — Purge stale legacy caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('Purging legacy cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Safe routing
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Only process GET requests; never touch POST/PUT/PATCH/DELETE
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Strictly skip dynamic Supabase and API requests
  if (isDynamicOrExcluded(url)) {
    return;
  }

  // Navigation requests (HTML pages): Network-First
  // Ensures user always gets the freshest deployed version with fallback to cached shell when offline
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Static assets (Vite bundled JS, CSS, fonts, SVG/PNG icons): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Message listener for manual update triggers
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
