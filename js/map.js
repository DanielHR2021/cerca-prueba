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
    o.businesses.forEach(function (b) {
      var el = makePin(b, o.onSelect, false);
      el.style.left = ((b.lng - B.west) / (B.east - B.west) * 100) + '%';
      el.style.top = ((B.north - b.lat) / (B.north - B.south) * 100) + '%';
      layer.appendChild(el); pins.set(b.id, { el: el });
    });
    return {
      update: function (s) { apply(pins, s); }, select: function () {}, home: function () {}, resize: function () {}, setTheme: function () {},
      destroy: function () { o.container.innerHTML = ''; }
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
    var timer = setTimeout(function () { fail('Tiempo agotado cargando el estilo del mapa'); }, c.mapTimeoutMs);
    map.on('load', function () { if (done) { return; } done = true; clearTimeout(timer); onLoaded(); });
    map.on('error', function (e) { if (!done && !map.isStyleLoaded()) { fail((e && e.error && e.error.message) || 'Error cargando el estilo del mapa'); } });
    o.businesses.forEach(function (b) {
      byId[b.id] = b;
      var el = makePin(b, o.onSelect, true);
      new ML.Marker({ element: el, anchor: 'bottom' }).setLngLat([b.lng, b.lat]).addTo(map);
      el.setAttribute('aria-label', b.name); /* MapLibre lo sobrescribe con «Map marker» al añadirlo */
      pins.set(b.id, { el: el });
    });
    return {
      update: function (s) { apply(pins, s); },
      select: function (id) { var b = byId[id]; if (b) { map.easeTo({ center: [b.lng, b.lat], duration: reduce ? 0 : 500 }); } },
      home: function () { map.easeTo({ center: c.mapCenter, zoom: c.mapZoom, duration: reduce ? 0 : 600 }); },
      resize: function () { map.resize(); },
      setTheme: function (t) { map.setStyle(styleFor(c, t)); },
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
    var impl, last = null, status = 'loading';
    function setStatus(s, msg) { status = s; o.container.dataset.map = s; ctl.status = s; if (o.onStatus) { o.onStatus(s, msg || ''); } }
    var ctl = {
      update: function (s) { last = s; impl.update(s); },
      select: function (id) { impl.select(id); },
      home: function () { impl.home(); },
      resize: function () { impl.resize(); },
      setTheme: function (t) { impl.setTheme(t); },
      status: status
    };
    function toFallback(err) {
      console.warn('[mapa] ' + err.message + '. Se muestra el esquema de respaldo (no es un mapa real).');
      try { impl.destroy(); } catch (e) { /* nada */ }
      impl = svgImpl(o); if (last) { impl.update(last); }
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
      if (last) { impl.update(last); }
    }).catch(toFallback);
    return ctl;
  };
})();
