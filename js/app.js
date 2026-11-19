/* Lógica de la interfaz. Sin dependencias; clásico (funciona abriendo index.html directamente). */
(function () {
  'use strict';
  var C = window.CERCA_CONFIG, DATA = window.CERCA_DEMO;
  var params = new URLSearchParams(location.search);
  if (params.get('map') === 'svg') { C.mapProvider = 'svg'; } else if (params.get('map') === 'maplibre') { C.mapProvider = 'maplibre'; }
  if (params.get('style')) { C.mapStyleUrl = params.get('style'); C.styleLocked = true; } // solo para probar otros estilos
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var norm = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };
  var CATS = ['Todos', 'Comida', 'Café', 'Tiendas', 'Servicios'];
  var COLORS = { Comida: '#F2A33A', 'Café': '#F0A6B8', Tiendas: '#8CC6E3', Servicios: '#A8D68A' };

  function currentHour() {
    var o = params.get('hora');
    if (o !== null && o !== '' && !isNaN(+o)) { return +o; }
    try { return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: C.timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()), 10) % 24; }
    catch (e) { return new Date().getHours(); }
  }
  var HOUR = currentHour();
  function fmtHour(h) { return (h % 12 === 0 ? 12 : h % 12) + ':00 ' + (h >= 12 ? 'p. m.' : 'a. m.'); }
  function isOpen(b) { return b.hours.from <= HOUR && HOUR < b.hours.to; }
  function hoursText(b) { return 'Hoy ' + fmtHour(b.hours.from) + ' a ' + fmtHour(b.hours.to); }
  function byId(id) { return DATA.filter(function (b) { return b.id === id; })[0]; }

  var state = { cat: 'Todos', q: '', openOnly: false, sel: null, pane: 'list', approx: false };

  /* ---------- Filtro y búsqueda ---------- */
  function filtered() {
    var items = DATA.filter(function (b) {
      return (state.cat === 'Todos' || b.category === state.cat) && (!state.openOnly || isOpen(b));
    });
    var q = state.q.trim();
    if (!q) { state.approx = false; return items; }
    var r = Cerca.search.rank(items, q);
    state.approx = r.approximate;
    return r.items;
  }

  /* ---------- Render ---------- */
  var el = {};
  function statusHtml(b) {
    return '<span class="status ' + (isOpen(b) ? 'is-open' : 'is-closed') + '">' + (isOpen(b) ? 'Abierto ahora' : 'Cerrado ahora') + '</span>' +
      (b.moved ? '<span class="tag tag--moved">Reubicado</span>' : '') + (b.fresh ? '<span class="tag tag--new">Nuevo</span>' : '');
  }
  function renderChips() {
    el.chips.innerHTML = CATS.map(function (c) {
      return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + '</button>';
    }).join('') + '<button type="button" class="chip chip--open" id="open-only" aria-pressed="' + state.openOnly + '">Abierto ahora</button>';
  }
  function renderList(items) {
    el.list.innerHTML = items.map(function (b) {
      var on = state.sel === b.id;
      return '<li class="card' + (on ? ' is-sel' : '') + '" data-id="' + b.id + '">' +
        '<button type="button" class="card-main" data-pick="' + b.id + '" aria-pressed="' + on + '">' +
        '<span class="card-name">' + esc(b.name) + '</span><span class="card-blurb">' + esc(b.blurb) + '</span>' +
        '<span class="card-meta">' + statusHtml(b) + '</span></button>' +
        '<a class="card-link" href="#/negocio/' + b.id + '" aria-label="Ver perfil de ' + esc(b.name) + '">Ver perfil</a></li>';
    }).join('');
    el.count.textContent = items.length + (items.length === 1 ? ' negocio' : ' negocios') + (state.approx && items.length ? ' · coincidencia aproximada' : '');
    el.empty.hidden = items.length > 0;
  }
  function renderSelCard(items) {
    var b = state.sel && byId(state.sel);
    var visible = b && items.indexOf(b) !== -1;
    el.selcard.hidden = !visible;
    if (!visible) { return; }
    el.selcard.innerHTML = '<h3>' + esc(b.name) + '</h3><p class="muted">' + esc(b.category) + ' · ' + hoursText(b) + '</p><p>' + esc(b.blurb) + '</p>' +
      '<div class="card-meta">' + statusHtml(b) + '</div><a class="btn btn--accent" href="#/negocio/' + b.id + '">Ver perfil</a>';
  }
  function render() {
    var items = filtered();
    if (state.sel && items.map(function (b) { return b.id; }).indexOf(state.sel) === -1) { state.sel = null; }
    renderList(items); renderSelCard(items);
    var vis = new Set(items.map(function (b) { return b.id; }));
    var closed = new Set(DATA.filter(function (b) { return !isOpen(b); }).map(function (b) { return b.id; }));
    map.update({ visible: vis, selected: state.sel, closed: closed });
    el.discover.dataset.pane = state.pane;
    $('#pane-list').setAttribute('aria-pressed', state.pane === 'list');
    $('#pane-map').setAttribute('aria-pressed', state.pane === 'map');
    return items;
  }

  /* ---------- Acciones ---------- */
  function afterFilterChange() {
    var items = render();
    if (items.length === 0) {
      var msg = state.q.trim()
        ? 'No encontré «' + state.q.trim() + '». Prueba con otra palabra o quita los filtros.'
        : 'Nada coincide con estos filtros. Prueba otra categoría o quita «Abierto ahora».';
      el.emptyText.textContent = msg;
    }
  }
  function pick(id, fromMap) {
    state.sel = id; render();
    if (!fromMap) { map.select(id); }
  }

  /* ---------- Rutas (#/ y #/negocio/ID) ---------- */
  function renderProfile(b) {
    var color = COLORS[b.category];
    $('#profile').innerHTML =
      '<a class="back" href="#/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Volver a descubrir</a>' +
      '<header class="cover" style="--cat:' + color + '"><h1 id="profile-title" tabindex="-1">' + esc(b.name) + '</h1><p>' + esc(b.description) + '</p><div class="card-meta">' + statusHtml(b) + '</div></header>' +
      '<div class="profile-grid"><section class="panel-card"><h2>Cuándo y dónde</h2><dl>' +
      '<dt>Categoría</dt><dd>' + esc(b.category) + '</dd><dt>Horario</dt><dd>' + hoursText(b) + '</dd>' +
      '<dt>Zona</dt><dd>' + esc(C.municipioNombre) + ', ' + esc(C.municipios[b.municipio].departamento) + '</dd><dt>Dirección</dt><dd class="placeholder">[Dirección de ejemplo, no es real]</dd></dl>' +
      '<button type="button" class="btn btn--accent" id="see-on-map">Ver en el mapa</button></section>' +
      '<section class="panel-card"><h2>Contacto</h2><p class="demo-note"><strong>Datos de prueba.</strong> Este negocio y su contacto son ficticios. En la plataforma real aparecerán aquí los datos del comerciante.</p>' +
      '<dl><dt>Teléfono</dt><dd class="placeholder">' + esc(b.phone) + '</dd><dt>WhatsApp</dt><dd class="placeholder">[WhatsApp ficticio]</dd></dl></section></div>';
    $('#see-on-map').addEventListener('click', function () { state.sel = b.id; state.pane = 'map'; location.hash = '#/'; });
  }
  function route() {
    var m = /^#\/negocio\/(\d+)$/.exec(location.hash), b = m && byId(+m[1]);
    $('#view-profile').hidden = !b; $('#view-home').hidden = !!b;
    if (b) {
      renderProfile(b); document.title = b.name + ' · ' + C.appName + ' (provisional)';
      window.scrollTo(0, 0); $('#profile-title').focus({ preventScroll: true });
    } else {
      document.title = C.appName + ' (provisional) · Descubre negocios locales';
      render(); map.resize();
      if (state.sel) { map.select(state.sel); }
    }
  }

  /* ---------- Arranque ---------- */
  el.chips = $('#chips'); el.list = $('#list'); el.count = $('#count'); el.empty = $('#empty'); el.emptyText = $('#empty-text');
  el.selcard = $('#selcard'); el.discover = $('#main');
  var statusEl = $('#map-status');
  var STATUS_TEXT = {
    loading: 'Cargando el mapa real…',
    fallback: 'Mapa real no disponible. Esto es solo un esquema de referencia.'
  };
  var map = Cerca.createMap({
    container: $('#map'), businesses: DATA, config: C, onSelect: function (id) { pick(id, true); },
    onStatus: function (s, why) {
      statusEl.hidden = s === 'maplibre'; statusEl.textContent = STATUS_TEXT[s] || '';
      if (s === 'fallback' && why) { statusEl.title = why; }
    }
  });
  $('#map-home-label').textContent = C.municipioNombre;
  $('#map-home').setAttribute('aria-label', 'Volver a ' + C.municipioNombre);
  $('#map-home').addEventListener('click', function () { map.home(); });

  /* Tema claro (dirección A) y oscuro (dirección C); la preferencia se recuerda. */
  var themeBtn = $('#theme-toggle');
  function paintTheme() { themeBtn.setAttribute('aria-pressed', document.documentElement.dataset.theme === 'dark'); }
  themeBtn.addEventListener('click', function () {
    var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('cerca.theme', next); } catch (e) { /* sin almacenamiento: solo dura esta visita */ }
    paintTheme(); map.setTheme(next);
  });
  paintTheme();

  renderChips();
  el.chips.addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) { return; }
    if (c.id === 'open-only') { state.openOnly = !state.openOnly; } else { state.cat = c.dataset.cat; }
    renderChips(); afterFilterChange();
  });
  el.list.addEventListener('click', function (e) { var b = e.target.closest('[data-pick]'); if (b) { pick(+b.dataset.pick, false); } });
  var input = $('#q');
  input.addEventListener('input', function () { state.q = input.value; afterFilterChange(); });
  $('#search-form').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#pane-list').addEventListener('click', function () { state.pane = 'list'; render(); });
  $('#pane-map').addEventListener('click', function () { state.pane = 'map'; render(); map.resize(); });
  window.addEventListener('hashchange', route);
  route();
})();
