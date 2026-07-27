const CACHE_PREFIX = 'virtual-checker';
const CACHE_VERSION = new URL(self.location.href).searchParams.get('v') || 'v1';
const PAGE_CACHE = `${CACHE_PREFIX}-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets-${CACHE_VERSION}`;
const STATIC_DESTINATIONS = new Set(['style', 'script', 'worker', 'image', 'font', 'video', 'audio', 'manifest']);
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/404.html',
  '/resetcookies.html',
  '/manifest.webmanifest',
  '/banner-meta.png',
  '/favicon.ico',
  '/admin/',
  '/admin/index.html',
  '/admin/archive.html',
  '/admin/backups.html',
  '/admin/courses.html',
  '/admin/drawings.html',
  '/admin/editor.html',
  '/admin/logs.html',
  '/admin/passwords.html',
  '/admin/questions.html',
  '/admin/reports.html',
  '/admin/responses.html',
  '/admin/upload.html',
  '/admin/users.html',
  '/ta/',
  '/ta/index.html',
  '/ta/questions.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PAGE_CACHE);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => {
      if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== PAGE_CACHE && cacheName !== ASSET_CACHE) {
        return caches.delete(cacheName);
      }
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (!STATIC_DESTINATIONS.has(request.destination)) return;

  event.respondWith(cacheFirst(request));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const matchingClient = allClients.find((client) => client.url.startsWith(self.location.origin));

    if (matchingClient) {
      await matchingClient.focus();
      if ('navigate' in matchingClient) {
        await matchingClient.navigate(targetUrl);
      }
      return;
    }

    await clients.openWindow(targetUrl);
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}