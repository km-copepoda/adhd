// Minimal service worker required for PWA installability
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.url.startsWith('http')) {
    e.respondWith(fetch(e.request));
  }
});
