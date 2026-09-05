const CACHE = 'reset-zilnic-shell-v1';
const SHELL = ['/zilnic.html', '/zilnic.js', '/logo-icon.png', '/apple-touch-icon.png', '/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Totul e static (nu exista date de server pentru aceasta aplicatie), asa ca
// mergem cache-first ca deschiderea de pe ecranul principal sa fie instanta si offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      const copie = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copie));
      return resp;
    }).catch(() => cached))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('zilnic.html') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/zilnic.html');
    })
  );
});
