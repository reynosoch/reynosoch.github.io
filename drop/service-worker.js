// Caches belong to this tool and scope; other tools share the Pages origin.
const CACHE_PREFIX = `reynoso-drop:${self.registration.scope}:`;
const CACHE = `${CACHE_PREFIX}v1.7.1`;
const SCOPE = new URL(self.registration.scope);
const SHELL = [
  './', './index.html', './styles.css', './theme.css', './favicon.svg', './manifest.webmanifest',
  './app.js', './session.js', './protocol.js', './files.js', './clipboard.js', './qr.js', './devices.js', './qrscan.js',
  './vendor/peerjs.min.js', './vendor/qrcode.js', './vendor/jsqr.js', './icons/icon-180.png', './icons/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {}));
      }
      return response;
    }).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(event.request, { ignoreSearch: true })) ||
        (event.request.mode === 'navigate' ? await cache.match('./index.html') : undefined) || Response.error();
    })
  );
});
