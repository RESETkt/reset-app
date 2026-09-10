const CACHE = 'reset-tablet-shell-v1';
const SHELL = ['/tablet.html', '/tablet.js', '/logo-icon.png', '/apple-touch-icon.png', '/icon-192.png'];

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

// Datele (/api/...) merg mereu direct la retea, ca sa nu arate programari/abonamente vechi.
// Doar fisierele statice ale check-in-ului sunt cache-uite, ca aplicatia de pe ecranul
// principal sa se deschida instant chiar daca semnalul wifi e slab.
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
