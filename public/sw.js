/* Saigon Taste Booking service worker – version {{v}}.
   Network first; the cache only helps the app open when the connection drops. Also shows push notifications. */
const CACHE = 'st-booking-{{v}}';
const V = '?v={{v}}';
const SHELL = ['/', '/app.css' + V, '/app.js' + V, '/icons/icon-192.png' + V, '/brand/mark.png' + V, '/brand/logo.png' + V];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/book/')) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (SHELL.includes(u.pathname + u.search) || e.request.mode === 'navigate')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request.mode === 'navigate' ? '/' : e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request.mode === 'navigate' ? '/' : e.request)));
});

/* ---- push notifications ---- */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Saigon Taste Booking', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'Saigon Taste Booking', {
      body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, timestamp: d.ts || Date.now(),
      icon: '/icons/icon-192.png' + V, badge: '/icons/badge-96.png' + V, data: { url: d.url || '/' }, vibrate: [200, 100, 200],
    }),
    // tell open windows to refresh their lists right away
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage({ type: 'push' }))),
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if (new URL(c.url).origin === location.origin && 'focus' in c) { c.postMessage({ type: 'open', url }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
