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
