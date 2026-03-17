// Minimal service worker required for PWA installability
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.url.startsWith('http')) {
    e.respondWith(fetch(e.request));
  }
});

// Web Push: アプリが表示中ならRealtimeに任せ、非表示/閉じている場合のみOS通知を出す
self.addEventListener('push', (e) => {
  e.waitUntil(
    clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((windowClients) => {
      const isVisible = windowClients.some((c) => c.visibilityState === 'visible');
      if (isVisible) return; // Realtimeが処理するためスキップ

      const data = e.data?.json() ?? {};
      return self.registration.showNotification(data.title ?? '通知', {
        body: data.body ?? '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: data.url ?? '/parent/approve' },
      });
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/parent/approve';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
