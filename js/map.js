/* Adaptador de mapa. La interfaz solo usa:
     var map = Cerca.createMap({ container, businesses, config, onSelect, onStatus });
     map.update({ visible:Set, selected:id|null, closed:Set }); map.select(id); map.home(); map.resize();
   Proveedor real: MapLibre GL JS + OpenFreeMap (se carga desde un CDN al abrir la página).
   Si no se puede cargar (sin internet, bloqueado, error de estilo) se muestra un ESQUEMA de respaldo,
   rotulado como tal: no es un mapa real. Estados: 'loading' | 'maplibre' | 'fallback'. */
(function () {
  window.Cerca = window.Cerca || {};
  var COLORS = { Comida: '#F2A33A', 'Café': '#F0A6B8', Tiendas: '#8CC6E3', Servicios: '#A8D68A' };

  function makePin(b, onSelect, geo) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'pin ' + (geo ? 'pin--geo' : 'pin--svg');
    el.setAttribute('aria-label', b.name);
    el.dataset.id = b.id;
    el.style.setProperty('--pin', COLORS[b.category] || '#F2A33A');
    el.innerHTML = '<span class="drop"></span>';
    el.addEventListener('click', function (e) { e.stopPropagation(); onSelect(b.id); });
    return el;
  }
  /* Marcador de «tu ubicación» (Módulo 01): un punto con borde blanco; no es interactivo. */
  function makeUserDot() {
    var el = document.createElement('div');
    el.className = 'user-dot';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Tu ubicación');
    return el;
  }
  /* Polígono circular aproximado (64 lados) de radio r metros alrededor de lng/lat. */
  function circle(lng, lat, r) {
    var pts = [], dLat = r / 111320, dLng = r / (111320 * Math.cos(lat * Math.PI / 180));
    for (var i = 0; i <= 64; i++) { var a = i / 64 * 2 * Math.PI; pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); }
    return pts;
  }
  function apply(pins, state) {
    pins.forEach(function (p, id) {
      p.el.hidden = !state.visible.has(id);
      p.el.classList.toggle('is-sel', state.selected === id);
      p.el.classList.toggle('is-closed', state.closed.has(id));
      p.el.setAttribute('aria-pressed', state.selected === id ? 'true' : 'false');
    });
  }

  /* ---------- Esquema de respaldo (NO es un mapa real) ---------- */
  var SVG_BG = '<svg class="map-bg" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
    '<rect class="mb-land" width="1000" height="800"/>' +
    '<path d="M-20 600 C 200 560, 330 680, 520 650 S 860 560, 1030 640 L1030 830 L-20 830Z" class="mb-water"/>' +
    '<rect class="mb-park" x="610" y="90" width="260" height="140" rx="40"/><rect class="mb-park" x="60" y="470" width="190" height="90" rx="36"/>' +
    '<g class="mb-road" stroke-width="22" stroke-linecap="round" fill="none"><path d="M-20 300 L1020 270"/><path d="M-20 470 L1020 430"/><path d="M180 -20 L230 820"/><path d="M470 -20 L520 820"/><path d="M760 -20 L800 820"/></g>' +
    '<g class="mb-road2" stroke-width="10" stroke-linecap="round" fill="none"><path d="M-20 160 L1020 140"/><path d="M-20 720 L1020 710"/><path d="M340 -20 L370 820"/><path d="M640 -20 L660 820"/></g>' +
    '<rect class="mb-park" x="395" y="320" width="150" height="100"  rx="30"/></svg>';

  function svgImpl(o) {
    var B = o.config.mapBounds, pins = new Map();
    o.container.innerHTML = SVG_BG + '<div class="pins"></div>';
    var layer = o.container.querySelector('.pins');
    // Mismo ajuste en el esquema de respaldo: tocar el fondo (no un marcador) cierra la ficha.
    o.container.onclick = function (e) { if (!e.target.closest('.pin') && o.onBackgroundClick) { o.onBackgroundClick(); } };
    o.businesses.forEach(function (b) {
      var el = makePin(b, o.onSelect, false);
      el.style.left = ((b.lng - B.west) / (B.east - B.west) * 100) + '%';
      el.style.top = ((B.north - b.lat) / (B.north - B.south) * 100) + '%';
      layer.appendChild(el); pins.set(b.id, { el: el });
    });
    var dot = null;
    return {
      update: function (s) { apply(pins, s); }, select: function () {}, home: function () {}, resize: function () {}, setTheme: function () {},
      /* En el esquema solo se puede situar el punto si cae dentro de los límites dibujados. */
      setUser: function (u) {
        var inside = u.lng >= B.west && u.lng <= B.east && u.lat >= B.south && u.lat <= B.north;
        if (!inside) { if (dot) { dot.remove(); dot = null; } return false; }
        if (!dot) { dot = makeUserDot(); dot.classList.add('user-dot--svg'); layer.appendChild(dot); }
        dot.style.left = ((u.lng - B.west) / (B.east - B.west) * 100) + '%';
        dot.style.top = ((B.north - u.lat) / (B.north - B.south) * 100) + '%';
        return true;
      },
      clearUser: function () { if (dot) { dot.remove(); dot = null; } },
      centerOnUser: function () {}, followUser: function () {}, center: function () { return null; },
      setRoute: function () { return false; }, clearRoute: function () {}, hasRoute: function () { return false; }, // el esquema no dibuja rutas
      destroy: function () { o.container.onclick = null; o.container.innerHTML = ''; }
    };
  }

  /* Estilo según el tema; ?style= fija un estilo y desactiva el cambio por tema. */
  function styleFor(c, theme) { return (!c.styleLocked && theme === 'dark' && c.mapStyleDark) ? c.mapStyleDark : c.mapStyleUrl; }
  function themeNow() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }

  /* ---------- Mapa real: MapLibre + OpenFreeMap ---------- */
  function maplibreImpl(o, onLoaded, onFail) {
    var c = o.config, pins = new Map(), byId = {}, done = false, ML = window.maplibregl;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var map = new ML.Map({ container: o.container, style: styleFor(c, themeNow()), center: c.mapCenter, zoom: c.mapZoom, dragRotate: false, pitchWithRotate: false,
      locale: { 'NavigationControl.ZoomIn': 'Acercar', 'NavigationControl.ZoomOut': 'Alejar', 'AttributionControl.ToggleAttribution': 'Mostrar u ocultar atribución', 'Marker.Title': 'Marcador' } });
    if (map.touchZoomRotate && map.touchZoomRotate.disableRotation) { map.touchZoomRotate.disableRotation(); }
    map.addControl(new ML.NavigationControl({ showCompass: false }), 'top-right');
    function fail(msg) { if (done) { return; } done = true; clearTimeout(timer); onFail(new Error(msg)); }
    /* El plazo solo cuenta con el mapa visible y la pestaña en primer plano: en segundo plano
       el navegador pausa el dibujado y MapLibre no puede terminar de cargar. */
    var timer;
    function arm() {
      timer = setTimeout(function () {
        if (document.hidden || !o.container.offsetWidth || !o.container.offsetHeight) { arm(); return; }
        fail('Tiempo agotado cargando el estilo del mapa');
      }, c.mapTimeoutMs);
    }
    arm();
    document.addEventListener('visibilitychange', function () { if (!done && !document.hidden) { clearTimeout(timer); arm(); } });
    /* Éxito = estilo descargado y procesado ('style.load'); no espera a dibujar teselas ('load'),
       que se retrasa si el mapa está oculto o el navegador pausa el dibujado. */
    map.once('style.load', function () { if (done) { return; } done = true; clearTimeout(timer); onLoaded(); });
    map.on('error', function (e) { if (!done && !map.isStyleLoaded()) { fail((e && e.error && e.error.message) || 'Error cargando el estilo del mapa'); } });
    o.businesses.forEach(function (b) {
      byId[b.id] = b;
      var el = makePin(b, o.onSelect, true);
      new ML.Marker({ element: el, anchor: 'bottom' }).setLngLat([b.lng, b.lat]).addTo(map);
      el.setAttribute('aria-label', b.name); /* MapLibre lo sobrescribe con «Map marker» al añadirlo */
      pins.set(b.id, { el: el });
    });
    /* ---- Tu ubicación: marcador HTML (se mueve con setLngLat, sin reconstruir) + círculo de precisión ---- */
    /* styleReady: el estilo terminó de cargar. No se usa map.isStyleLoaded(), que devuelve false
       mientras se descargan teselas (justo después de mover el mapa o cambiar de tema). */
    var user = null, userMarker = null, ACC = 'nubi-user-acc', styleReady = false;
    map.on('style.load', function () { styleReady = true; });
    function accColor() { return getComputedStyle(document.documentElement).getPropertyValue('--geo').trim() || '#1C6790'; }
    function drawAccuracy() {
      if (!user || !styleReady) { return; }
      var data = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(user.lng, user.lat, Math.max(user.accuracy || 0, 5))] } };
      var src = map.getSource(ACC);
      if (src) { src.setData(data); return; }
      map.addSource(ACC, { type: 'geojson', data: data });
      map.addLayer({ id: ACC + '-fill', type: 'fill', source: ACC, paint: { 'fill-color': accColor(), 'fill-opacity': 0.14 } });
      map.addLayer({ id: ACC + '-line', type: 'line', source: ACC, paint: { 'line-color': accColor(), 'line-width': 1.5, 'line-opacity': 0.55 } });
    }
    function removeAccuracy() {
      [ACC + '-line', ACC + '-fill'].forEach(function (id) { if (map.getLayer(id)) { map.removeLayer(id); } });
      if (map.getSource(ACC)) { map.removeSource(ACC); }
    }
    map.on('style.load', drawAccuracy); // setStyle (cambio de tema) borra las capas propias: se vuelven a añadir

    /* ---- Fase 3: ruta (geometría del proveedor, nunca una línea recta inventada) ---- */
    var routeCoords = null, RT = 'nubi-route';
    function drawRoute() {
      if (!routeCoords || !styleReady) { return; }
      var data = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords } };
      var src = map.getSource(RT);
      if (src) { src.setData(data); return; }
      var dark = document.documentElement.dataset.theme === 'dark';
      map.addSource(RT, { type: 'geojson', data: data });
      map.addLayer({ id: RT + '-casing', type: 'line', source: RT, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#0F1A22' : '#FFFFFF', 'line-width': 9, 'line-opacity': 0.9 } });
      map.addLayer({ id: RT + '-line', type: 'line', source: RT, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': accColor(), 'line-width': 5 } });
    }
    function removeRoute() {
      [RT + '-line', RT + '-casing'].forEach(function (id) { if (map.getLayer(id)) { map.removeLayer(id); } });
      if (map.getSource(RT)) { map.removeSource(RT); }
    }
    map.on('style.load', drawRoute);
    /* Ajuste UX Fase 3: tocar una zona vacía del mapa cierra la ficha. El 'click' de MapLibre ya descarta los
       arrastres (tolerancia de 3 px) y no se emite al pellizcar ni con la rueda; los marcadores detienen su clic
       (stopPropagation) y los controles están fuera del lienzo. El doble toque (acercar) emite un clic antes de
       'dblclick': por eso se espera 260 ms y se cancela si llega el doble toque. */
    var bgTimer = null;
    map.on('click', function () { if (!o.onBackgroundClick) { return; } clearTimeout(bgTimer); bgTimer = setTimeout(o.onBackgroundClick, 260); });
    map.on('dblclick', function () { clearTimeout(bgTimer); });
    /* Movimiento manual (arrastrar, pellizcar, rueda o botones +/−): MapLibre incluye originalEvent solo en esos casos. */
    ['dragstart', 'zoomstart'].forEach(function (ev) { map.on(ev, function (e) { if (e && e.originalEvent && o.onManualMove) { o.onManualMove(); } }); });
    var anim = null;
    return {
      /* opts.animate: el punto se desliza ~0,6 s hacia la nueva posición (sin reconstruir nada).
         Sin animación con movimiento reducido o si el salto es mayor de 500 m. */
      setUser: function (u, opts) {
        var prev = user; user = u;
        if (!userMarker) { userMarker = new ML.Marker({ element: makeUserDot(), anchor: 'center' }).setLngLat([u.lng, u.lat]).addTo(map); drawAccuracy(); return true; }
        if (anim) { cancelAnimationFrame(anim); anim = null; }
        var far = prev ? Cerca.geo.distanceM(prev, u) > 500 : true;
        if (!(opts && opts.animate) || reduce || far) { userMarker.setLngLat([u.lng, u.lat]); drawAccuracy(); return true; }
        var from = userMarker.getLngLat(), t0 = performance.now();
        (function step(t) {
          var k = Math.min(1, (t - t0) / 600); k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          userMarker.setLngLat([from.lng + (u.lng - from.lng) * k, from.lat + (u.lat - from.lat) * k]);
          if (k < 1) { anim = requestAnimationFrame(step); } else { anim = null; drawAccuracy(); }
        })(t0);
        return true;
      },
      followUser: function () { if (user) { map.easeTo({ center: [user.lng, user.lat], duration: reduce ? 0 : 600 }); } },
      /* pad.bottom: alto de lo que tapa el mapa por abajo (la tarjeta del negocio), para que la ruta quede a la vista. */
      setRoute: function (coords, pad) {
        routeCoords = coords; if (styleReady) { removeRoute(); } drawRoute();
        var w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
        coords.forEach(function (p) { w = Math.min(w, p[0]); e = Math.max(e, p[0]); s = Math.min(s, p[1]); n = Math.max(n, p[1]); });
        var H = o.container.clientHeight || 500, top = 130, bottom = Math.min((pad && pad.bottom) || 200, Math.max(40, H - top - 120));
        map.fitBounds([[w, s], [e, n]], { padding: { top: top, bottom: bottom, left: 40, right: 40 }, maxZoom: 17.5, duration: reduce ? 0 : 700 });
        return true;
      },
      clearRoute: function () { routeCoords = null; if (styleReady) { removeRoute(); } },
      hasRoute: function () { return !!map.getLayer(RT + '-line'); },
      center: function () { var c = map.getCenter(); return { lat: c.lat, lng: c.lng }; },
      clearUser: function () { user = null; if (userMarker) { userMarker.remove(); userMarker = null; } if (styleReady) { removeAccuracy(); } },
      hasAccuracy: function () { return !!map.getLayer(ACC + '-fill'); },
      centerOnUser: function () {
        if (!user) { return; }
        var acc = user.accuracy || 50;
        if (acc > 300) {   // precisión pobre: encuadrar el círculo entero en vez de acercar demasiado
          var d = acc / 111320, e = acc / (111320 * Math.cos(user.lat * Math.PI / 180));
          map.fitBounds([[user.lng - e, user.lat - d], [user.lng + e, user.lat + d]], { padding: 40, maxZoom: 16, duration: reduce ? 0 : 700 });
        } else {
          map.easeTo({ center: [user.lng, user.lat], zoom: Math.max(map.getZoom(), 16.5), duration: reduce ? 0 : 700 });
        }
      },
      update: function (s) { apply(pins, s); },
      select: function (id) { var b = byId[id]; if (b) { map.easeTo({ center: [b.lng, b.lat], duration: reduce ? 0 : 500 }); } },
      home: function () { map.easeTo({ center: c.mapCenter, zoom: c.mapZoom, duration: reduce ? 0 : 600 }); },
      resize: function () { map.resize(); if (!done) { clearTimeout(timer); arm(); } /* plazo completo al mostrarse */ },
      /* diff:false fuerza una carga completa: con el modo «diff» (por defecto) MapLibre borra las capas propias
         sin emitir 'style.load', y el círculo de precisión no se podría volver a dibujar. */
      setTheme: function (t) { styleReady = false; map.setStyle(styleFor(c, t), { diff: false }); },
      destroy: function () { done = true; clearTimeout(timer); try { map.remove(); } catch (e) { /* ya liberado */ } }
    };
  }

  /* Carga MapLibre desde la lista de CDN, en orden. */
  function loadMapLibre(c) {
    function tryBase(base) {
      return new Promise(function (resolve, reject) {
        var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'maplibre-gl.css'; document.head.appendChild(css);
        var s = document.createElement('script'); s.src = base + 'maplibre-gl.js';
        var timer = setTimeout(function () { reject(new Error('tiempo agotado: ' + base)); }, 8000);
        s.onload = function () { clearTimeout(timer); window.maplibregl ? resolve() : reject(new Error('sin maplibregl: ' + base)); };
        s.onerror = function () { clearTimeout(timer); reject(new Error('no disponible: ' + base)); };
        document.head.appendChild(s);
      });
    }
    if (window.maplibregl) { return Promise.resolve(); }
    var bases = c.maplibreCdns.map(function (u) { return u.replace('{v}', c.maplibreVersion); });
    return bases.reduce(function (p, base) { return p.catch(function () { return tryBase(base); }); }, Promise.reject(new Error('inicio')))
      .catch(function () { throw new Error('No se pudo cargar MapLibre desde ningún CDN'); });
  }

  Cerca.createMap = function (o) {
    var impl, last = null, status = 'loading', lastUser = null;
    function setStatus(s, msg) { status = s; o.container.dataset.map = s; ctl.status = s; if (o.onStatus) { o.onStatus(s, msg || ''); } }
    var ctl = {
      update: function (s) { last = s; impl.update(s); },
      select: function (id) { impl.select(id); },
      home: function () { impl.home(); },
      resize: function () { impl.resize(); },
      setTheme: function (t) { impl.setTheme(t); },
      /* Tu ubicación (Módulo 01). setUser devuelve false si el motor actual no puede mostrarla. */
      setUser: function (u, opts) { lastUser = u; return impl.setUser(u, opts); },
      clearUser: function () { lastUser = null; impl.clearUser(); },
      centerOnUser: function () { impl.centerOnUser(); },
      followUser: function () { impl.followUser(); },   // Fase 2: recentra sin cambiar el zoom
      setRoute: function (coords, pad) { return impl.setRoute(coords, pad); },   // Fase 3: devuelve false si el motor no puede
      clearRoute: function () { impl.clearRoute(); },
      hasRoute: function () { return impl.hasRoute(); },
      user: function () { return lastUser; },             // para pruebas
      center: function () { return impl.center(); },      // para pruebas
      hasAccuracy: function () { return impl.hasAccuracy ? impl.hasAccuracy() : false; }, // para pruebas
      isReal: function () { return status === 'maplibre'; },
      status: status
    };
    function toFallback(err) {
      console.warn('[mapa] ' + err.message + '. Se muestra el esquema de respaldo (no es un mapa real).');
      try { impl.destroy(); } catch (e) { /* nada */ }
      impl = svgImpl(o); if (last) { impl.update(last); } if (lastUser) { impl.setUser(lastUser); }
      setStatus('fallback', err.message);
    }
    if (o.config.mapProvider !== 'maplibre') {
      impl = svgImpl(o); setStatus('fallback', 'Esquema solicitado con ?map=svg');
      return ctl;
    }
    impl = svgImpl(o); setStatus('loading');
    loadMapLibre(o.config).then(function () {
      impl.destroy();
      impl = maplibreImpl(o, function () { setStatus('maplibre'); }, toFallback);
      if (last) { impl.update(last); } if (lastUser) { impl.setUser(lastUser); }
    }).catch(toFallback);
    return ctl;
  };
})();
