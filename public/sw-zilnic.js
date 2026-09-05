const CACHE = 'reset-zilnic-shell-v2';
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

// Pagina si manifestul merg network-first (sa se vada imediat orice schimbare, ex. numele
// aplicatiei), restul (js, iconite) cache-first ca deschiderea de pe ecran sa fie instanta.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const proaspat = e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('manifest.json');

  if (proaspat) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copie = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copie));
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

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
