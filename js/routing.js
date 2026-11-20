/* Rutas (Módulo 01, Fase 3). Proveedores desacoplados del mapa: devuelven geometría, distancia y duración.
   Investigación y políticas en docs/modulos/M01-geolocalizacion-rutas.md.
   - Principal: OSRM de FOSSGIS con perfil a pie (routing.openstreetmap.de/routed-foot).
   - Respaldo: Valhalla de FOSSGIS con costing «pedestrian» (valhalla1.openstreetmap.de).
   Servidores comunitarios: máximo 1 petición por segundo, uso moderado, atribución obligatoria. Por eso
   solo se pide una ruta cuando el usuario la solicita, nunca en bucle, y se guarda en caché en memoria.
   route(from, to) -> Promise<{ coords:[[lng,lat]...], distanceM, durationS, provider }>; si falla rechaza con
   { code, message }: 'too_far' | 'offline' | 'timeout' | 'rate' | 'unavailable' | 'no_route'. Nunca inventa una ruta. */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var ATTR = 'Datos © colaboradores de OpenStreetMap';
  var MSG = {
    too_far: 'El destino está demasiado lejos para una ruta a pie (más de 50 km en línea recta).',
    offline: 'Sin conexión a internet no podemos calcular la ruta. Revisa tu conexión e inténtalo de nuevo.',
    timeout: 'El servicio de rutas tardó demasiado en responder. Inténtalo de nuevo en un momento.',
    rate: 'El servicio de rutas recibió muchas solicitudes. Espera unos segundos e inténtalo de nuevo.',
    unavailable: 'El servicio de rutas no está disponible en este momento. Inténtalo más tarde.',
    no_route: 'No encontramos una ruta a pie hasta este lugar.'
  };
  function fail(code) { return { code: code, message: MSG[code] }; }

  /* Decodifica una polilínea de Google con precisión 6 (formato de Valhalla) a [[lng, lat], ...]. */
  function decode6(str) {
    var i = 0, lat = 0, lng = 0, out = [];
    while (i < str.length) {
      var shift = 0, res = 0, b;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 31) << shift; shift += 5; } while (b >= 32);
      lat += (res & 1) ? ~(res >> 1) : (res >> 1);
      shift = 0; res = 0;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 31) << shift; shift += 5; } while (b >= 32);
      lng += (res & 1) ? ~(res >> 1) : (res >> 1);
      out.push([lng / 1e6, lat / 1e6]);
    }
    return out;
  }

  var PROVIDERS = {
    'fossgis-osrm': {
      name: 'OSRM de FOSSGIS', attribution: 'Ruta: OSRM (FOSSGIS). ' + ATTR,
      url: function (a, b) { return 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/' + a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=full&geometries=geojson&steps=false'; },
      parse: function (j) {
        if (j && j.code === 'Ok' && j.routes && j.routes[0] && j.routes[0].geometry) {
          var r = j.routes[0]; return { coords: r.geometry.coordinates, distanceM: r.distance, durationS: r.duration };
        }
        if (j && (j.code === 'NoRoute' || j.code === 'NoSegment')) { throw fail('no_route'); }
        throw fail('unavailable');
      }
    },
    'fossgis-valhalla': {
      name: 'Valhalla de FOSSGIS', attribution: 'Ruta: Valhalla (FOSSGIS). ' + ATTR,
      url: function (a, b) {
        return 'https://valhalla1.openstreetmap.de/route?json=' + encodeURIComponent(JSON.stringify({
          locations: [{ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng }], costing: 'pedestrian', units: 'kilometers', directions_type: 'none' }));
      },
      parse: function (j) {
        if (j && j.trip && j.trip.legs && j.trip.legs[0]) {
          var s = j.trip.summary; return { coords: decode6(j.trip.legs[0].shape), distanceM: s.length * 1000, durationS: s.time };
        }
        if (j && (j.error_code === 442 || j.error_code === 171 || j.error_code === 170)) { throw fail('no_route'); }
        throw fail('unavailable');
      }
    }
  };

  var cache = {}, lastCall = 0;
  function key(a, b) { return [a.lat, a.lng, b.lat, b.lng].map(function (n) { return n.toFixed(4); }).join(','); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function ask(p, a, b) {
    // Respeta el límite de 1 petición por segundo del servidor.
    var gap = Math.max(0, 1100 - (Date.now() - lastCall));
    return wait(gap).then(function () {
      lastCall = Date.now();
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) { ctl.abort(); } }, Cerca.routing.TIMEOUT_MS);
      return Cerca.routing.fetch(p.url(a, b), ctl ? { signal: ctl.signal } : {}).then(function (res) {
        clearTimeout(timer);
        if (res.status === 429) { throw fail('rate'); }
        if (res.status >= 500) { throw fail('unavailable'); }
        return res.json().catch(function () { throw fail('unavailable'); });
      }, function (e) {
        clearTimeout(timer);
        if (e && e.name === 'AbortError') { throw fail('timeout'); }
        throw fail(navigator.onLine === false ? 'offline' : 'unavailable');
      }).then(function (j) {
        var r = p.parse(j);
        if (!r.coords || r.coords.length < 2 || !isFinite(r.distanceM) || !isFinite(r.durationS)) { throw fail('unavailable'); }
        r.provider = { id: p.id, name: p.name, attribution: p.attribution };
        return r;
      });
    });
  }

  function route(a, b) {
    if (Cerca.geo.distanceM(a, b) > 50000) { return Promise.reject(fail('too_far')); }
    if (navigator.onLine === false) { return Promise.reject(fail('offline')); }
    var k = key(a, b);
    if (cache[k]) { return Promise.resolve(cache[k]); }
    var ids = Cerca.routing.order.slice();
    function next(lastErr) {
      var id = ids.shift();
      if (!id) { return Promise.reject(lastErr || fail('unavailable')); }
      var p = Object.assign({ id: id }, PROVIDERS[id]);
      return ask(p, a, b).catch(function (err) {
        // Con «sin ruta» o «sin conexión» no tiene sentido probar otro proveedor.
        if (err && (err.code === 'no_route' || err.code === 'offline')) { throw err; }
        return next(err);
      });
    }
    return next().then(function (r) { cache[k] = r; return r; });
  }

  Cerca.routing = {
    route: route, providers: PROVIDERS, order: ['fossgis-osrm', 'fossgis-valhalla'], decode6: decode6,
    TIMEOUT_MS: 12000,
    fetch: function (url, opts) { return window.fetch(url, opts); }, // reemplazable en pruebas
    clearCache: function () { cache = {}; }
  };
})();
