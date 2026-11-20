/* Service worker mínimo de la PWA de prueba.
   Red primero para los archivos propios (siempre la versión publicada más reciente);
   la copia en caché solo se usa sin conexión. El mapa, las teselas y las fuentes externas no se guardan. */
var CACHE = 'cerca-v13';
var SHELL = ['./', 'index.html', 'css/styles.css?v=13', 'css/profiles.css?v=13', 'js/config.js?v=13', 'js/data.js?v=13', 'js/map.js?v=13', 'js/geo.js?v=13', 'js/routing.js?v=13', 'js/search.js?v=13', 'js/brand.js?v=13',
  'js/profiles.js?v=13', 'js/editor.js?v=13', 'js/app.js?v=13', 'js/assistant.js?v=13', 'manifest.webmanifest', 'assets/brand/icon-192.png', 'assets/brand/favicon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) { return; }
  /* cache: 'no-cache' revalida con el servidor (304 si no cambió) para no servir versiones viejas */
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) { return hit || caches.match('index.html'); });
  }));
});
