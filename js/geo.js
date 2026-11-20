/* Geolocalización (Módulo 01). Solo la Geolocation API nativa del navegador.
   - Nunca se llama sola: la interfaz la invoca cuando el usuario pulsa «Mi ubicación».
   - Las coordenadas no se guardan ni se envían a ningún servidor propio.
   - Sin geolocalización por IP ni servicios externos.
   locate() -> Promise<{ lat, lng, accuracy, ts }>; si falla, rechaza con { code, message } donde code es
   'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout'. */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 };
  var MSG = {
    unsupported: 'Este navegador no permite obtener tu ubicación. Puedes seguir explorando el mapa normalmente.',
    insecure: 'La ubicación solo funciona en una conexión segura (https). Puedes seguir explorando el mapa normalmente.',
    denied: 'No diste permiso para usar tu ubicación. Puedes seguir usando Nubi; si cambias de opinión, permite la ubicación para este sitio en los ajustes del navegador.',
    unavailable: 'No pudimos obtener tu ubicación. Revisa que la ubicación o el GPS del celular estén activados e inténtalo de nuevo.',
    timeout: 'Tu ubicación tardó demasiado en llegar. Inténtalo de nuevo, mejor cerca de una ventana o al aire libre.'
  };
  function provider() { return Cerca.geo.provider !== undefined ? Cerca.geo.provider : (navigator.geolocation || null); }
  function fail(code) { return { code: code, message: MSG[code] }; }

  function locate(opts) {
    return new Promise(function (resolve, reject) {
      var api = provider();
      if (!api || typeof api.getCurrentPosition !== 'function') { reject(fail('unsupported')); return; }
      if (window.isSecureContext === false && !Cerca.geo.provider) { reject(fail('insecure')); return; }
      api.getCurrentPosition(function (p) {
        var c = p && p.coords;
        if (!c || !isFinite(c.latitude) || !isFinite(c.longitude)) { reject(fail('unavailable')); return; }
        resolve({ lat: c.latitude, lng: c.longitude, accuracy: isFinite(c.accuracy) ? c.accuracy : null, ts: p.timestamp || Date.now() });
      }, function (err) {
        var code = err && err.code === 1 ? 'denied' : err && err.code === 3 ? 'timeout' : 'unavailable';
        reject(fail(code));
      }, Object.assign({}, OPTIONS, opts || {}));
    });
  }

  /* Distancia en metros entre dos puntos {lat, lng} (fórmula del semiverseno). */
  function distanceM(a, b) {
    var R = 6371000, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function fmtDistance(m) {
    if (m < 1000) { return Math.round(m) + ' m'; }
    return (m < 10000 ? (m / 1000).toFixed(1).replace('.', ',') : Math.round(m / 1000)) + ' km';
  }

  Cerca.geo = { locate: locate, distanceM: distanceM, fmtDistance: fmtDistance, OPTIONS: OPTIONS, provider: undefined };
})();
