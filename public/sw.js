/* Service worker AUTO-DESTRUCTEUR.
   Le mode hors-ligne a été retiré. Ce fichier existe uniquement pour que les
   navigateurs ayant déjà enregistré l'ancien SW le purgent et se désenregistrent
   automatiquement à la prochaine visite (les navigateurs revérifient sw.js). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => { try { c.navigate(c.url); } catch (e) {} });
    } catch (e) { /* best-effort */ }
  })());
});
