/* Service worker mínimo de la PWA de prueba.
   Red primero para los archivos propios (siempre la versión publicada más reciente);
   la copia en caché solo se usa sin conexión. El mapa, las teselas y las fuentes externas no se guardan. */
var CACHE = 'cerca-v18';
var SHELL = ['./', 'index.html', 'css/styles.css?v=18', 'css/profiles.css?v=18', 'js/config.js?v=18', 'js/data.js?v=18', 'js/store.js?v=18', 'js/map.js?v=18', 'js/geo.js?v=18', 'js/routing.js?v=18', 'js/search.js?v=18', 'js/brand.js?v=18',
  'js/profiles.js?v=18', 'js/editor.js?v=18', 'js/app.js?v=18', 'js/assistant.js?v=18', 'js/auth.js?v=18', 'js/registro.js?v=18', 'js/moderacion.js?v=18', 'manifest.webmanifest', 'assets/brand/icon-192.png', 'assets/brand/favicon.svg'];

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
