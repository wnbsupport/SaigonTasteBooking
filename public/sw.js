/* Saigon Taste Booking service worker – version {{v}}. Network first; the cache only helps the app open when the connection drops. */
const CACHE = 'st-booking-{{v}}';
const SHELL = ['/', '/app.css?v={{v}}', '/app.js?v={{v}}', '/manifest.webmanifest', '/icons/icon-192.png', '/brand/mark.png', '/brand/logo.png'];
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
