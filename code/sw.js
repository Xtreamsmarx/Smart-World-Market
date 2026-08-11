/* Smart World Market Service Worker - PWA offline support */
const CACHE = 'sxw-v1';
const PRECACHE = ['/', '/vitrin', '/search-page', '/member', '/login', '/shared/common.css', '/shared/common.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const cloned = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, cloned));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
