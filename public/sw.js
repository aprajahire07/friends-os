/**
 * FRIEND OS — Progressive Web App Service Worker
 * 
 * STRICT CACHING POLICY:
 * - Caches ONLY static application assets (HTML shell, JS, CSS, fonts, app icons).
 * - NEVER caches Supabase API calls (Auth, REST, Storage, Realtime, WebSockets).
 * - NEVER caches sensitive credentials, passwords, or user-specific records.
 * - Uses Network-First for navigation so new deployments are served immediately.
 */

const CACHE_NAME = 'friend-os-shell-v2';
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
    urlStr.includes('/functions/v1/') ||
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

// ==============================================================================
// WEB PUSH NOTIFICATIONS (Mobile & Desktop System Level Push API)
// ==============================================================================

/**
 * Listen for incoming Web Push events dispatched by Supabase Edge Function
 */
self.addEventListener('push', (event) => {
  let payload = {};
  
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: 'Friend OS',
        body: event.data.text()
      };
    }
  }

  const title = payload.title || 'Friend OS';
  const section = payload.section || (payload.data && payload.data.section) || 'home';
  const tag = payload.tag || `friend-os-${section}-${Date.now()}`;

  const notificationOptions = {
    body: payload.body || 'You have a new update in Friend OS.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    image: payload.image || undefined,
    tag: tag,
    renotify: true,
    requireInteraction: false,
    vibrate: [120, 60, 120],
    timestamp: payload.timestamp || Date.now(),
    data: {
      url: payload.url || `/?tab=${section}`,
      section: section,
      customData: payload.data || {},
      receivedAt: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

/**
 * Handle notification taps/clicks — focus or open Friend OS and navigate to correct section
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const section = data.section || 'home';
  
  // Section mapping to ensure canonical tab routing
  const sectionToTabMap = {
    money: 'expenses',
    expenses: 'expenses',
    notes: 'notes',
    snaps: 'snaps',
    plans: 'plans',
    chat: 'chat',
    memories: 'memories',
    attendance: 'attendance',
    borrowed: 'borrowed',
    passwords: 'admin',
    admin: 'admin',
    home: 'home'
  };

  const targetTab = sectionToTabMap[section.toLowerCase()] || section || 'home';
  const targetUrl = data.url || `/?tab=${targetTab}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Look for an existing open window/tab of Friend OS
      for (const client of clientList) {
        if ('focus' in client) {
          // Send navigation message to React App
          client.postMessage({
            type: 'NAVIGATE_TAB',
            tab: targetTab,
            section: section,
            data: data.customData || {}
          });
          return client.focus();
        }
      }

      // If no window is currently open, launch a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close event for analytics / cleanup
self.addEventListener('notificationclose', (event) => {
  // Optional telemetry hook
});

