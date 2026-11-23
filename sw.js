// Service worker : notifications (Android) + fonctionnement hors ligne.
// Stratégie « réseau d'abord » : en ligne, tu as toujours la dernière version publiée ;
// sans réseau, l'appli s'ouvre depuis le cache. Les appels Google (Drive, connexion) ne sont jamais mis en cache.
const CACHE = 'journal-v15';
const SHELL = ['./', 'index.html', 'app.js', 'drive.js', 'stats.js', 'style.css', 'checklist.html', 'manifest.json', 'manifest-checklist.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('journal-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {               // polices : cache d'abord
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { c.put(req, r.clone()).catch(() => {}); return r; }))));
    return;
  }
  if (url.origin !== self.location.origin) return;       // Google Drive, connexion, news : jamais en cache
  if (url.pathname.endsWith('sw.js')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(req, { signal: ctl.signal }); clearTimeout(timer);
      if (r && r.ok && r.type === 'basic') c.put(req.mode === 'navigate' ? new Request(url.origin + url.pathname) : req, r.clone()).catch(() => {});
      return r;
    } catch (err) {
      const hit = await c.match(req.mode === 'navigate' ? new Request(url.origin + url.pathname) : req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const idx = await c.match('index.html') || await c.match('./'); if (idx) return idx; }
      throw err;
    }
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
