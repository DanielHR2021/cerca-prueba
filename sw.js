/* Service worker mínimo de la PWA de prueba.
   Red primero para los archivos propios (siempre la versión publicada más reciente);
   la copia en caché solo se usa sin conexión. El mapa, las teselas y las fuentes externas no se guardan. */
var CACHE = 'cerca-v21';
var SHELL = ['./', 'index.html', 'css/styles.css?v=21', 'css/profiles.css?v=21', 'js/config.js?v=21', 'js/data.js?v=21', 'js/store.js?v=21', 'js/map.js?v=21', 'js/geo.js?v=21', 'js/routing.js?v=21', 'js/search.js?v=21', 'js/brand.js?v=21',
  'js/profiles.js?v=21', 'js/editor.js?v=21', 'js/app.js?v=21', 'js/assistant.js?v=21', 'js/auth.js?v=21', 'js/registro.js?v=21', 'js/moderacion.js?v=21', 'js/privacidad.js?v=21','manifest.webmanifest', 'assets/brand/icon-192.png', 'assets/brand/icon-512.png', 'assets/brand/icon-maskable-192.png', 'assets/brand/icon-maskable-512.png', 'assets/brand/apple-touch-icon.png', 'assets/brand/favicon.svg'];

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
