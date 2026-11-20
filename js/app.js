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
    if (!q) { state.approx = false; state.hits = {}; return items; }
    var r = Cerca.search.rank(items, q);
    state.approx = r.approximate; state.hits = r.hits;
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
      '<span class="card-ico pfv" style="' + Cerca.profiles.vars(b) + '">' + Cerca.profiles.icon(b.icon, 24) + '</span><span class="card-txt">' +
      '<span class="card-name">' + esc(b.name) + '</span><span class="card-blurb">' + esc(b.blurb) + '</span>' +
      (mode === 'pick' && state.q.trim() && state.hits && state.hits[b.id] && Cerca.search.words(state.hits[b.id]).join(' ') !== Cerca.search.words(state.q).join(' ')
        ? '<span class="card-hit"><span class="sr-only">Coincide con </span>' + esc(state.hits[b.id]) + '</span>' : '') +
      '<span class="card-meta">' + statusHtml(b) + '</span></span></button>' + saveBtn(b) +
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
  function profileHelpers(preview) {
    return { statusHtml: statusHtml, hoursText: hoursText, isSaved: isSaved, place: C.municipioNombre, dept: C.municipios[C.municipio].departamento, preview: !!preview };
  }
  function renderProfile(b) { $('#profile').innerHTML = Cerca.profiles.render(b, profileHelpers(false)); }
  var toastTimer = null;
  function toast(text) {
    var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function profileAction(btn) {
    var note = btn.closest('.pf').querySelector('.pf-note');
    if (btn.getAttribute('aria-disabled') === 'true') { note.textContent = btn.dataset.why; note.hidden = false; return; }
    var b = state.profile; if (!b) { return; }
    if (btn.dataset.pfAct === 'map') { showMap(b.id); }
    if (btn.dataset.pfAct === 'share') {
      var url = location.href.split('#')[0] + '#/negocio/' + b.id, data = { title: b.name, text: b.name + ' en ' + C.municipioNombre + ' (negocio de prueba)', url: url };
      if (navigator.share) { navigator.share(data).catch(function () { /* el usuario canceló */ }); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(url).then(function () { toast('Enlace copiado.'); }, function () { toast('Copia este enlace: ' + url); }); }
      else { toast('Copia este enlace: ' + url); }
    }
  }
  var VIEWS = { home: 'Explorar', saved: 'Guardados', owner: 'Tu negocio', settings: 'Ajustes', profile: '', draft: 'Vista previa de tu negocio' };
  function route() {
    var h = location.hash || '#/';
    var m = /^#\/negocio\/(\d+)$/.exec(h), b = m && byId(+m[1]);
    var prev = state.view;
    state.view = b ? 'profile' : h === '#/guardados' ? 'saved' : h === '#/mi-negocio' ? 'owner' : h === '#/mi-negocio/vista' ? 'draft' : h === '#/ajustes' ? 'settings' : 'home';
    state.profile = b || null;
    Object.keys(VIEWS).forEach(function (v) { $('#view-' + v).hidden = v !== state.view; });
    var navKey = state.view === 'profile' ? 'home' : state.view === 'draft' ? 'owner' : state.view;
    $$('[data-nav]').forEach(function (a) { if (a.dataset.nav === navKey) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); } });
    document.title = (b ? b.name : VIEWS[state.view]) + ' · ' + C.appName;
    if (state.view === 'profile') { renderProfile(b); }
    if (state.view === 'saved') { renderSaved(); }
    if (state.view === 'owner' && Cerca.editor) { Cerca.editor.refresh(); }
    if (state.view === 'draft' && Cerca.editor) { $('#draft-profile').innerHTML = Cerca.profiles.render(Cerca.editor.draft(), profileHelpers(true)); }
    if (state.view !== 'home' && geoCtl && geoCtl.tracking()) { geoCtl.stopTracking('Detuvimos el seguimiento al salir del mapa.'); }
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
  /* Mascota Nubi (Dúo) en la portada y en «sin resultados» */
  $('#hero-mascot').innerHTML = Cerca.brand.mascot('feliz');
  $('#empty-mascot').innerHTML = Cerca.brand.mascot('triste');
  var statusEl = $('#map-status');
  var STATUS_TEXT = {
    loading: 'Cargando el mapa real…',
    fallback: 'Mapa real no disponible. Esto es solo un esquema de referencia.'
  };
  var onManualMove = function () {}; // lo define el módulo de ubicación (Fase 2)
  var map = Cerca.createMap({
    container: $('#map'), businesses: DATA, config: C, onSelect: function (id) { pick(id, true); },
    onManualMove: function () { onManualMove(); },
    onStatus: function (s, why) {
      statusEl.hidden = s === 'maplibre'; statusEl.textContent = STATUS_TEXT[s] || '';
      if (s === 'fallback' && why) { statusEl.title = why; }
    }
  });
  $('#map-home-label').textContent = C.municipioNombre;
  $('#map-home').setAttribute('aria-label', 'Volver a ' + C.municipioNombre);
  $('#map-home').addEventListener('click', function () { onManualMove(); map.home(); });

  /* ---------- Módulo 01: Mi ubicación (Fase 1) y seguimiento (Fase 2) ----------
     El permiso se pide solo al pulsar el botón. Las coordenadas quedan en memoria: no se guardan ni se envían.
     El seguimiento solo corre con la app en primer plano y con el mapa a la vista. */
  var geoCtl = (function () {
    var btn = $('#map-locate'), lbl = $('#map-locate-lbl'), box = $('#geo-msg'), txt = $('#geo-msg-text'), acts = $('#geo-msg-acts');
    var stopBtn = $('#map-track-stop'), recenterBtn = $('#map-recenter'), group = $('#map-geo');
    var busy = false, here = null, hideTimer = null, center = { lat: C.mapCenter[1], lng: C.mapCenter[0] };
    var stopWatch = null, tracking = false, paused = false, follow = false, lastFix = null, lastAt = 0, limitTimer = null;
    function hide() { box.hidden = true; clearTimeout(hideTimer); }
    function place() { box.style.top = (group.offsetTop + group.offsetHeight + 8) + 'px'; } // el aviso va bajo los botones
    function show(text, opts) {
      opts = opts || {};
      txt.textContent = text; acts.innerHTML = '';
      (opts.acts || []).forEach(function (a) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'geo-act'; b.textContent = a[0];
        b.addEventListener('click', a[1]); acts.appendChild(b);
      });
      box.classList.toggle('is-error', !!opts.error); box.hidden = false; place();
      clearTimeout(hideTimer); if (opts.autoHide) { hideTimer = setTimeout(hide, opts.autoHide); }
    }
    function setBusy(b) {
      busy = b; btn.setAttribute('aria-busy', b ? 'true' : 'false');
      lbl.textContent = b ? 'Buscando…' : tracking ? 'Siguiéndote' : (here ? 'Actualizar ubicación' : 'Mi ubicación');
    }
    function paintTracking() {
      stopBtn.hidden = !tracking; recenterBtn.hidden = !(tracking && !follow);
      btn.classList.toggle('is-tracking', tracking); setBusy(false); if (!box.hidden) { place(); }
    }

    /* ---- Fase 2: seguimiento ---- */
    function onFix(u) {
      // Ahorro: se ignoran cambios menores a 5 m (o a media precisión) si llegan en menos de 15 s.
      var now = Date.now();
      if (lastFix && now - lastAt < 15000 && Cerca.geo.distanceM(lastFix, u) < Math.max(5, (u.accuracy || 0) / 2) &&
          Math.abs((u.accuracy || 0) - (lastFix.accuracy || 0)) < 10) { return; }
      lastFix = u; lastAt = now; here = u;
      map.setUser(u, { animate: true });
      if (follow) { map.followUser(); }
    }
    function onWatchError(err) {
      if (err.code === 'timeout') { return; } // pasajero: se sigue esperando la próxima posición
      stopTracking(); show(err.message, { error: true });
    }
    function startWatch() { stopWatch = Cerca.geo.watch(onFix, onWatchError); }
    function startTracking() {
      if (tracking) { return; }
      tracking = true; follow = true; paused = false; lastFix = here; lastAt = Date.now();
      startWatch(); paintTracking(); map.followUser();
      clearTimeout(limitTimer);
      limitTimer = setTimeout(function () { stopTracking('Detuvimos el seguimiento después de ' + Math.round(Cerca.geo.TRACK_MAX_MS / 60000) + ' minutos para ahorrar batería. Puedes volver a activarlo.'); }, Cerca.geo.TRACK_MAX_MS);
      show('Te seguimos mientras la app esté abierta en el mapa. Toca «Detener seguimiento» cuando termines.', { autoHide: 5000 });
    }
    function stopTracking(reason) {
      if (!tracking) { return; }
      if (stopWatch) { stopWatch(); stopWatch = null; }
      tracking = false; follow = false; paused = false; clearTimeout(limitTimer); paintTracking();
      if (reason) { show(reason, { autoHide: 6000 }); }
    }
    function recenter() { follow = true; paintTracking(); map.followUser(); }
    onManualMove = function () { if (tracking && follow) { follow = false; paintTracking(); } };
    // Nunca en segundo plano: al ocultarse la página se pausa y al volver se reanuda.
    document.addEventListener('visibilitychange', function () {
      if (!tracking) { return; }
      if (document.hidden && stopWatch) { stopWatch(); stopWatch = null; paused = true; }
      else if (!document.hidden && paused) { paused = false; startWatch(); }
    });
    stopBtn.addEventListener('click', function () { stopTracking('Seguimiento detenido. Tu ubicación queda en el mapa hasta que la quites.'); });
    recenterBtn.addEventListener('click', recenter);

    function clearUser() { stopTracking(); here = null; lastFix = null; map.clearUser(); btn.classList.remove('is-on'); setBusy(false); show('Quitamos tu ubicación del mapa.', { autoHide: 3000 }); }
    function locate() {
      if (busy) { return; }
      setBusy(true); show('Buscando tu ubicación…');
      Cerca.geo.locate().then(function (u) {
        here = u; btn.classList.add('is-on'); setBusy(false);
        var shown = map.setUser(u), far = Cerca.geo.distanceM(u, center), parts = [], list = [['Quitar mi ubicación', clearUser]];
        parts.push(!shown ? 'Te encontramos, pero el esquema de respaldo no puede mostrar puntos fuera de su zona.'
          : u.accuracy != null ? 'Te encontramos (precisión ± ' + Cerca.geo.fmtDistance(u.accuracy) + ').' : 'Te encontramos.');
        if (u.accuracy != null && u.accuracy > 500) { parts.push('Es una ubicación aproximada: activa la ubicación precisa del celular para mejorarla.'); }
        if (far > 15000) {
          parts.push('Estás a ' + Cerca.geo.fmtDistance(far) + ' de ' + C.municipioNombre + ', donde están los negocios.');
          list.unshift(['Volver a ' + C.municipioNombre, function () { map.home(); hide(); }]);
        }
        if (shown && !tracking) { list.unshift(['Seguir mi ubicación', startTracking]); }
        if (shown) { if (tracking) { follow = true; paintTracking(); map.followUser(); } else { map.centerOnUser(); } }
        show(parts.join(' '), { acts: list });
      }, function (err) {
        setBusy(false);
        show(err.message, { error: true, acts: (err.code === 'timeout' || err.code === 'unavailable') ? [['Intentar de nuevo', locate]] : [] });
      });
    }
    btn.addEventListener('click', locate);
    $('#geo-msg-close').addEventListener('click', hide);
    return { stopTracking: stopTracking, tracking: function () { return tracking; } };
  })();

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
  $('#pane-list').addEventListener('click', function () { state.pane = 'list'; render(); if (geoCtl.tracking()) { geoCtl.stopTracking('Detuvimos el seguimiento al pasar a la lista.'); } });
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

  /* Acciones rápidas de los perfiles (también en la vista previa, donde solo explican que no actúan). */
  document.addEventListener('click', function (e) { var b = e.target.closest('.pf-act'); if (b && !b.hasAttribute('data-save')) { profileAction(b); } });

  /* API para el asistente y el editor: solo funciones que existen en la interfaz. */
  Cerca.app = {
    profileHelpers: profileHelpers,
    mapState: function () { return { real: map.isReal(), accuracyLayer: map.hasAccuracy(), user: map.user(), center: map.center(), tracking: geoCtl.tracking() }; }, // solo para pruebas
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
