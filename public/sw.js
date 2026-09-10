const CACHE = 'reset-shell-v1';
const SHELL = ['/index.html', '/styles.css', '/app.js', '/logo-icon.png', '/favicon-v2.png'];

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

// Datele (/api/...) merg mereu direct la retea, ca sa nu arate informatii vechi.
// Doar fisierele statice ale aplicatiei (html/css/js/iconite) sunt cache-uite, ca aplicatia
// sa se deschida instant si sa nu ramana alba daca semnalul e slab la pornire.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const copie = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copie));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

// Notificare push de la server (ex: notificare noua adaugata de un coleg), chiar cand aplicatia e inchisa
self.addEventListener('push', e => {
  let date = {};
  try { date = e.data ? e.data.json() : {}; } catch { date = {}; }

  e.waitUntil(
    self.registration.showNotification(date.title || 'Reset', {
      body: date.body || '',
      icon: '/icon-192.png',
      badge: '/logo-icon.png',
      data: { url: date.url || '/index.html' }
    })
  );
});

// La click pe notificare, aduce in fata un tab deja deschis sau deschide unul nou
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/index.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(listaTaburi => {
      for (const tab of listaTaburi) {
        if ('focus' in tab) return tab.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
