/* Scrivaelo — service worker : mode hors-ligne réel (app-shell + cache runtime).
   Stratégie prudente :
   - navigations : réseau d'abord, repli cache (app-shell) hors-ligne ;
   - assets même origine (GET) : stale-while-revalidate ;
   - AUCUNE mise en cache des requêtes vers des tiers (IA, LanguageTool) :
     le contenu du manuscrit ne doit jamais être écrit dans un cache. */
const CACHE = 'scrivaelo-shell-v1';
const PRECACHE = [
  './',
  './legacy-bundle.js',
  './docx-bundle.js',
  './vendor/purify.min.js',
  './vendor/tabler/tabler-icons.min.css',
  './vendor/tabler/fonts/tabler-icons.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u)))) // best-effort
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // jamais de cache tiers

  // Navigation : réseau d'abord, repli app-shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Assets : stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const refresh = fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
