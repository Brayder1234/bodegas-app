// Billon: app instalable, avisos push y carga instantánea (la página guardada se muestra al instante y se actualiza detrás)
const CACHE = 'billon-shell-v1';
const SHELL = '/index.html';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
async function avisarCambio() {
  for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'update' });
}
async function pagina(req) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(SHELL);
  const red = fetch(req).then(async r => {
    if (r && r.ok) {
      const nuevoTag = r.headers.get('etag') || r.headers.get('last-modified') || '';
      const viejoTag = guardada ? (guardada.headers.get('etag') || guardada.headers.get('last-modified') || '') : '';
      await cache.put(SHELL, r.clone());
      if (guardada && nuevoTag && nuevoTag !== viejoTag) avisarCambio();
    }
    return r;
  }).catch(() => null);
  if (guardada) return guardada;
  return (await red) || new Response('Sin conexión. Vuelve a intentarlo.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === SHELL) { e.respondWith(pagina(req)); e.waitUntil(Promise.resolve()); return; }
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Billon', {
    body: d.body || '', icon: 'icon-192.png', badge: 'favicon.png', tag: d.tag || 'billon', data: { url: d.url || '/' }, renotify: true }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
