const CACHE_NAME = 'performance-feedback-pwa-v2';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './app-icon.svg'];

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isHtmlRequest(request) {
  return request.headers.get('accept')?.includes('text/html') ?? false;
}

async function updateCache(request, response) {
  if (!response.ok) {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isNavigationRequest(event.request) || isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => updateCache(event.request, response))
        .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => updateCache(event.request, response)).catch(() => cached);

      return cached ?? networkFetch;
    }),
  );
});