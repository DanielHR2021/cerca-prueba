/* Lógica de la interfaz. Sin dependencias; clásico (funciona abriendo index.html directamente).
   Vistas por hash: #/ Explorar, #/guardados, #/mi-negocio, #/ajustes, #/negocio/ID (perfil).
   Expone Cerca.app para que el asistente use las mismas funciones que la interfaz. */
(function () {
  'use strict';
  var C = window.CERCA_CONFIG, DATA = window.CERCA_DEMO;
  var params = new URLSearchParams(location.search);
  if (params.get('map') === 'svg') { C.mapProvider = 'svg'; } else if (params.get('map') === 'maplibre') { C.mapProvider = 'maplibre'; }
  if (params.get('style')) { C.mapStyleUrl = params.get('style'); C.styleLocked = true; } // solo para probar otros estilos
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var CATS = ['Todos', 'Comida', 'Café', 'Tiendas', 'Servicios'];
  var COLORS = { Comida: '#F2A33A', 'Café': '#F0A6B8', Tiendas: '#8CC6E3', Servicios: '#A8D68A' };
  var ICON_SAVE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';
  var mascot = function (m) { if (window.Cerca.assistant) { Cerca.assistant.mood(m); } };

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

  var state = { cat: 'Todos', q: '', openOnly: false, sel: null, pane: 'list', approx: false, view: 'home' };

  /* ---------- Guardados (solo en este dispositivo) ---------- */
  var SAVED_KEY = 'cerca.saved';
  var saved = (function () {
    var ids = [];
    try { ids = JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch (e) { ids = []; }
    return ids.filter(function (id) { return !!byId(id); });
  })();
  function persist() { try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch (e) { /* sin almacenamiento: dura esta visita */ } }
  function isSaved(id) { return saved.indexOf(id) !== -1; }
  function toggleSave(id) {
    if (!byId(id)) { return false; }
    if (isSaved(id)) { saved.splice(saved.indexOf(id), 1); } else { saved.unshift(id); mascot('celebrate'); }
    persist(); paintSaved();
    if (state.view === 'saved') { renderSaved(); }
    return isSaved(id);
  }
  function clearSaved() { saved = []; persist(); paintSaved(); if (state.view === 'saved') { renderSaved(); } }
  function saveBtn(b) {
    return '<button type="button" class="save" data-save="' + b.id + '" aria-pressed="' + isSaved(b.id) + '" aria-label="Guardar ' + esc(b.name) + '">' + ICON_SAVE + '</button>';
  }
  function paintSaved() {
    $$('[data-save]').forEach(function (btn) {
      var on = isSaved(+btn.dataset.save); btn.setAttribute('aria-pressed', on);
      var lbl = btn.querySelector('.save-lbl'); if (lbl) { lbl.textContent = on ? 'Guardado' : 'Guardar'; }
    });
    var badge = $('#saved-count'); badge.textContent = saved.length || ''; badge.hidden = !saved.length;
    var n = $('#settings-saved-n'); if (n) { n.textContent = saved.length; }
  }

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
  function cardHtml(b, mode) { // mode 'pick' = selecciona en el mapa; 'map' = abre Explorar en el mapa
    var on = mode === 'pick' && state.sel === b.id;
    return '<li class="card' + (on ? ' is-sel' : '') + '" data-id="' + b.id + '">' +
      '<button type="button" class="card-main" data-' + mode + '="' + b.id + '"' + (mode === 'pick' ? ' aria-pressed="' + on + '"' : '') + '>' +
      '<span class="card-name">' + esc(b.name) + '</span><span class="card-blurb">' + esc(b.blurb) + '</span>' +
      '<span class="card-meta">' + statusHtml(b) + '</span></button>' + saveBtn(b) +
      '<a class="card-link" href="#/negocio/' + b.id + '" aria-label="Ver perfil de ' + esc(b.name) + '">Ver perfil</a></li>';
  }
  function renderChips() {
    el.chips.innerHTML = CATS.map(function (c) {
      return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + '</button>';
    }).join('') + '<button type="button" class="chip chip--open" id="open-only" aria-pressed="' + state.openOnly + '">Abierto ahora</button>';
  }
  function renderList(items) {
    el.list.innerHTML = items.map(function (b) { return cardHtml(b, 'pick'); }).join('');
    el.count.textContent = items.length + (items.length === 1 ? ' negocio' : ' negocios') + (state.approx && items.length ? ', coincidencia aproximada' : '');
    el.empty.hidden = items.length > 0;
  }
  function renderSelCard(items) {
    var b = state.sel && byId(state.sel);
    var visible = b && items.indexOf(b) !== -1;
    el.selcard.hidden = !visible;
    if (!visible) { return; }
    el.selcard.innerHTML = '<h3>' + esc(b.name) + '</h3><p class="muted">' + esc(b.category) + ', ' + hoursText(b).toLowerCase() + '</p><p>' + esc(b.blurb) + '</p>' +
      '<div class="card-meta">' + statusHtml(b) + '</div><div class="selcard-actions"><a class="btn btn--accent" href="#/negocio/' + b.id + '">Ver perfil</a>' + saveBtn(b) + '</div>';
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
  function renderSaved() {
    var items = saved.map(byId);
    $('#saved-list').innerHTML = items.map(function (b) { return cardHtml(b, 'map'); }).join('');
    $('#saved-empty').hidden = items.length > 0;
    $('#saved-note').hidden = !items.length;
  }

  /* ---------- Acciones ---------- */
  function afterFilterChange() {
    var items = render();
    if (items.length === 0) {
      var msg = state.q.trim()
        ? 'No encontré «' + state.q.trim() + '». Prueba con otra palabra o quita los filtros.'
        : 'Nada coincide con estos filtros. Prueba otra categoría o quita «Abierto ahora».';
      el.emptyText.textContent = msg;
      mascot('empty');
    }
    return items;
  }
  function pick(id, fromMap) {
    state.sel = id; render();
    if (!fromMap) { map.select(id); }
  }
  function go(hash) { if (location.hash !== hash) { location.hash = hash; } else { route(); } }
  function showMap(id) {
    state.pane = 'map';
    if (id) { var b = byId(id); if (b && filtered().indexOf(b) === -1) { state.q = ''; state.cat = 'Todos'; state.openOnly = false; el.input.value = ''; renderChips(); } state.sel = id; }
    go('#/');
  }

  /* ---------- Vistas ---------- */
  function renderProfile(b) {
    var color = COLORS[b.category];
    $('#profile').innerHTML =
      '<a class="back" href="#/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Volver a explorar</a>' +
      '<header class="cover" style="--cat:' + color + '"><h1 id="profile-title" tabindex="-1">' + esc(b.name) + '</h1><p>' + esc(b.description) + '</p><div class="card-meta">' + statusHtml(b) + '</div></header>' +
      '<div class="profile-grid"><section class="panel-card"><h2>Cuándo y dónde</h2><dl>' +
      '<dt>Categoría</dt><dd>' + esc(b.category) + '</dd><dt>Horario</dt><dd>' + hoursText(b) + '</dd>' +
      '<dt>Zona</dt><dd>' + esc(C.municipioNombre) + ', ' + esc(C.municipios[b.municipio].departamento) + '</dd><dt>Dirección</dt><dd class="placeholder">[Dirección de ejemplo, no es real]</dd></dl>' +
      '<div class="row-actions"><button type="button" class="btn btn--accent" id="see-on-map">Ver en el mapa</button>' +
      '<button type="button" class="btn btn--ghost" data-save="' + b.id + '" aria-pressed="' + isSaved(b.id) + '">' + ICON_SAVE + '<span class="save-lbl">' + (isSaved(b.id) ? 'Guardado' : 'Guardar') + '</span></button></div></section>' +
      '<section class="panel-card"><h2>Contacto</h2><p class="demo-note"><strong>Datos de prueba.</strong> Este negocio y su contacto son ficticios. En la plataforma real aparecerán aquí los datos del comerciante.</p>' +
      '<dl><dt>Teléfono</dt><dd class="placeholder">' + esc(b.phone) + '</dd><dt>WhatsApp</dt><dd class="placeholder">[WhatsApp ficticio]</dd></dl></section></div>';
    $('#see-on-map').addEventListener('click', function () { showMap(b.id); });
  }
  var VIEWS = { home: 'Explorar', saved: 'Guardados', owner: 'Tu negocio', settings: 'Ajustes', profile: '' };
  function route() {
    var h = location.hash || '#/';
    var m = /^#\/negocio\/(\d+)$/.exec(h), b = m && byId(+m[1]);
    var prev = state.view;
    state.view = b ? 'profile' : h === '#/guardados' ? 'saved' : h === '#/mi-negocio' ? 'owner' : h === '#/ajustes' ? 'settings' : 'home';
    state.profile = b || null;
    Object.keys(VIEWS).forEach(function (v) { $('#view-' + v).hidden = v !== state.view; });
    var navKey = state.view === 'profile' ? 'home' : state.view;
    $$('[data-nav]').forEach(function (a) { if (a.dataset.nav === navKey) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); } });
    document.title = (b ? b.name : VIEWS[state.view]) + ' · ' + C.appName + ' (provisional)';
    if (state.view === 'profile') { renderProfile(b); }
    if (state.view === 'saved') { renderSaved(); }
    if (state.view === 'home') {
      render(); map.resize();
      if (state.sel) { map.select(state.sel); }
    }
    if (prev !== state.view || state.view === 'profile') {
      window.scrollTo(0, 0);
      var t = $('#view-' + state.view + ' h1');
      if (t && prev) { t.focus({ preventScroll: true }); }
    }
    if (window.Cerca.assistant) { Cerca.assistant.onRoute(state.view); }
  }

  /* ---------- Arranque ---------- */
  el.chips = $('#chips'); el.list = $('#list'); el.count = $('#count'); el.empty = $('#empty'); el.emptyText = $('#empty-text');
  el.selcard = $('#selcard'); el.discover = $('#main'); el.input = $('#q');
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
  function theme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
  function paintTheme() {
    $$('[data-theme-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', theme() === 'dark'); });
    var lbl = $('#settings-theme-lbl'); if (lbl) { lbl.textContent = theme() === 'dark' ? 'Oscuro' : 'Claro'; }
  }
  function toggleTheme() {
    var next = theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('cerca.theme', next); } catch (e) { /* sin almacenamiento: solo dura esta visita */ }
    paintTheme(); map.setTheme(next);
    return next;
  }
  $$('[data-theme-toggle]').forEach(function (b) { b.addEventListener('click', toggleTheme); });
  paintTheme();

  renderChips();
  el.chips.addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) { return; }
    if (c.id === 'open-only') { state.openOnly = !state.openOnly; } else { state.cat = c.dataset.cat; }
    renderChips(); afterFilterChange();
  });
  el.list.addEventListener('click', function (e) { var b = e.target.closest('[data-pick]'); if (b) { pick(+b.dataset.pick, false); } });
  $('#saved-list').addEventListener('click', function (e) { var b = e.target.closest('[data-map]'); if (b) { showMap(+b.dataset.map); } });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-save]'); if (b) { toggleSave(+b.dataset.save); } });
  el.input.addEventListener('input', function () {
    state.q = el.input.value;
    if (afterFilterChange().length && state.q.trim()) { mascot('search'); }
  });
  $('#search-form').addEventListener('submit', function (e) { e.preventDefault(); el.input.blur(); });
  $('#pane-list').addEventListener('click', function () { state.pane = 'list'; render(); });
  $('#pane-map').addEventListener('click', function () { state.pane = 'map'; render(); map.resize(); });
  $('#clear-saved').addEventListener('click', function () {
    if (!saved.length) { return; }
    if (window.confirm('¿Borrar los ' + saved.length + ' negocios guardados en este dispositivo?')) { clearSaved(); }
  });

  /* Instalación PWA: el botón solo aparece si el navegador ofrece instalar. */
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; $('#install-btn').hidden = false; });
  $('#install-btn').addEventListener('click', function () {
    if (!installEvt) { return; }
    installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; $('#install-btn').hidden = true; });
  });

  /* Vista previa local de la tarjeta de un negocio (no se guarda ni se envía). */
  (function () {
    var f = $('#owner-form'), out = $('#owner-preview');
    var hours = ''; for (var h = 0; h < 24; h++) { hours += '<option value="' + h + '">' + fmtHour(h) + '</option>'; }
    $('#of-from').innerHTML = hours; $('#of-to').innerHTML = hours; $('#of-from').value = '8'; $('#of-to').value = '18';
    $('#of-cat').innerHTML = CATS.slice(1).map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    function paint() {
      var b = { name: $('#of-name').value.trim() || 'Nombre de tu negocio', blurb: $('#of-blurb').value.trim() || 'Una frase corta sobre lo que ofreces.',
        hours: { from: +$('#of-from').value, to: +$('#of-to').value }, moved: false, fresh: true };
      out.innerHTML = '<span class="card-name">' + esc(b.name) + '</span><span class="card-blurb">' + esc(b.blurb) + '</span>' +
        '<span class="card-meta">' + (b.hours.to > b.hours.from
          ? statusHtml(b) + '<span class="muted">' + esc($('#of-cat').value) + ', ' + hoursText(b).toLowerCase() + '</span>'
          : '<span class="status is-closed">La hora de cierre debe ser después de la apertura.</span>') + '</span>';
      out.style.setProperty('--cat', COLORS[$('#of-cat').value]);
    }
    f.addEventListener('input', paint); f.addEventListener('submit', function (e) { e.preventDefault(); }); paint();
  })();

  /* API para el asistente: solo funciones que existen en la interfaz. */
  Cerca.app = {
    data: DATA, categories: CATS.slice(1), isOpen: isOpen, hoursText: hoursText, byId: byId,
    view: function () { return state.view; }, profile: function () { return state.profile; },
    search: function (q) { state.q = q; state.cat = 'Todos'; state.openOnly = false; state.pane = 'list'; el.input.value = q; renderChips(); go('#/'); return afterFilterChange(); },
    setCategory: function (c) { state.cat = c; state.q = ''; el.input.value = ''; state.pane = 'list'; renderChips(); go('#/'); return afterFilterChange(); },
    openNow: function () { state.openOnly = true; state.cat = 'Todos'; state.q = ''; el.input.value = ''; state.pane = 'list'; renderChips(); go('#/'); return afterFilterChange(); },
    openNowList: function () { return DATA.filter(isOpen); },
    showMap: showMap, home: function () { showMap(null); map.home(); },
    go: go, toggleTheme: toggleTheme, theme: theme,
    isSaved: isSaved, toggleSave: toggleSave, saved: function () { return saved.slice(); },
    canInstall: function () { return !!installEvt; },
    focusSearch: function () { go('#/'); setTimeout(function () { el.input.focus(); }, 50); }
  };

  window.addEventListener('hashchange', route);
  paintSaved();
  route();
})();
