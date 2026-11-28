/* Lógica de la interfaz. Sin dependencias; clásico (funciona abriendo index.html directamente).
   Vistas por hash: #/ Explorar, #/guardados, #/mi-negocio, #/ajustes, #/negocio/ID (perfil).
   Expone Cerca.app para que el asistente use las mismas funciones que la interfaz. */
// T8: la app arranca cuando la capa de datos tiene los negocios (inmediato con la demo; tras la consulta con Supabase).
Cerca.store.ready().then(function () {
  'use strict';
  var C = window.CERCA_CONFIG, S = Cerca.store, DATA = S.list(); // T1: los negocios llegan solo por la capa de datos
  var params = new URLSearchParams(location.search);
  if (params.get('map') === 'svg') { C.mapProvider = 'svg'; } else if (params.get('map') === 'maplibre') { C.mapProvider = 'maplibre'; }
  if (params.get('style')) { C.mapStyleUrl = params.get('style'); C.styleLocked = true; } // solo para probar otros estilos
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var CATS = ['Todos', 'Comida', 'Café', 'Tiendas', 'Servicios'];
  var ICON_SAVE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';
  var mascot = function (m) { if (window.Cerca.assistant) { Cerca.assistant.mood(m); } };

  /* Momento actual en la zona horaria del municipio: { day: 0-6 (domingo = 0), min }. Para pruebas: ?hora=H y ?dia=D. */
  function currentTime() {
    var t = { day: new Date().getDay(), min: new Date().getHours() * 60 + new Date().getMinutes() };
    try {
      var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: C.timezone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      t = { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), min: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10) };
    } catch (e) { /* sin Intl: hora del dispositivo */ }
    var h = params.get('hora'), d = params.get('dia');
    if (h !== null && h !== '' && !isNaN(+h)) { t.min = (+h) * 60; }
    if (d !== null && d !== '' && !isNaN(+d)) { t.day = (+d) % 7; }
    return t;
  }
  var NOW = currentTime();
  // T2: true solo si el horario publicado lo confirma; sin horario conocido nunca se dice «abierto».
  function isOpen(b) { return S.openAt(b, NOW) === true; }
  function hoursText(b) { return S.hoursLabel(b, NOW); }
  function byId(id) { return S.get(id); }

  // Descubrimiento (2026-11-27): se abre en la lista, donde están TODOS los negocios (con o sin local); el mapa solo
  // puede mostrar los que tienen punto público. state.modo filtra por cómo atiende: null | 'local' | 'zona' | 'en_linea'.
  var state = { cat: 'Todos', q: '', openOnly: false, modo: null, sel: null, pane: 'list', approx: false, view: 'home' };

  /* ---------- Guardados (solo en este dispositivo) ---------- */
  // T2: se guardan identificadores estables (uid); la migración desde 'cerca.saved' la hace la capa de datos sin borrar nada.
  var saved = S.favorites.load();
  function persist() { S.favorites.save(saved); }
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
      return (state.cat === 'Todos' || b.category === state.cat) && (!state.openOnly || isOpen(b)) && (!state.modo || S.attendMode(b) === state.modo);
    });
    var q = state.q.trim();
    if (!q) { state.approx = false; state.hits = {}; state.tooShort = false; return items; }
    var r = Cerca.search.rank(items, q);
    state.approx = r.approximate; state.hits = r.hits; state.tooShort = !!r.tooShort;
    return r.items;
  }

  /* ---------- Render ---------- */
  var el = {};
  function statusHtml(b) {
    var o = S.openAt(b, NOW); // null = no se sabe (con cita, variable o sin horario): no se afirma abierto ni cerrado
    var txt = o === true ? 'Abierto ahora' : o === false ? 'Cerrado ahora' : hoursText(b);
    return '<span class="status' + (o === true ? ' is-open' : o === false ? ' is-closed' : '') + '">' + esc(txt) + '</span>' +
      (b.moved ? '<span class="tag tag--moved">Reubicado</span>' : '') + (b.fresh ? '<span class="tag tag--new">Nuevo</span>' : '');
  }
  /* Etiqueta «cómo atiende» de las tarjetas: corta y sin dirección (la dirección va en la ficha). */
  var I_MODO = {
    local: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
    zona: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
    en_linea: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>'
  };
  function modoTag(b) {
    var m = S.attendMode(b), t = m === 'local' ? 'Con local' : m === 'en_linea' ? 'En línea' : b.delivery ? 'A domicilio' : 'Por zona'; // la zona y la dirección van en la ficha
    return '<span class="tag tag--modo tag--' + m + '" title="' + esc(S.attendLabel(b)) + '">' + I_MODO[m] + esc(t) + '</span>';
  }
  function cardHtml(b, mode) { // mode 'pick' = selecciona en el mapa; 'map' = abre Explorar en el mapa
    var on = mode === 'pick' && state.sel === b.id;
    return '<li class="card' + (on ? ' is-sel' : '') + '" data-id="' + b.id + '">' +
      '<button type="button" class="card-main" data-' + mode + '="' + b.id + '"' + (mode === 'pick' ? ' aria-pressed="' + on + '"' : '') + '>' +
      '<span class="card-ico pfv" style="' + Cerca.profiles.vars(b) + '">' + Cerca.profiles.icon(b.icon, 24) + '</span><span class="card-txt">' +
      '<span class="card-name">' + esc(b.name) + '</span><span class="card-blurb">' + esc(b.blurb) + '</span>' +
      (mode === 'pick' && state.q.trim() && state.hits && state.hits[b.id] && Cerca.search.words(state.hits[b.id]).join(' ') !== Cerca.search.words(state.q).join(' ')
        ? '<span class="card-hit"><span class="sr-only">Coincide con </span>' + esc(state.hits[b.id]) + '</span>' : '') +
      '<span class="card-meta">' + modoTag(b) + statusHtml(b) + '</span></span></button>' + saveBtn(b) +
      '<a class="card-link" href="#/negocio/' + b.slug + '" aria-label="Ver perfil de ' + esc(b.name) + '">Ver perfil</a></li>';
  }
  function renderChips() {
    el.chips.innerHTML = CATS.map(function (c) {
      return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + '</button>';
    }).join('') + '<button type="button" class="chip chip--open" id="open-only" aria-pressed="' + state.openOnly + '">Abierto ahora</button>' +
      // «Cómo atiende»: solo las formas que existen hoy (con 2 negocios no se ofrecen filtros vacíos; con miles salen todas).
      modosPresentes().map(function (m) {
        return '<button type="button" class="chip chip--modo" data-modo="' + m + '" aria-pressed="' + (state.modo === m) + '">' + I_MODO[m] + '<span>' + esc(S.ATIENDE[m]) + '</span></button>';
      }).join('');
  }
  function modosPresentes() {
    var set = {}; DATA.forEach(function (b) { set[S.attendMode(b)] = true; });
    var l = ['local', 'zona', 'en_linea'].filter(function (m) { return set[m]; });
    return l.length > 1 || state.modo ? l : []; // si todos atienden igual, el filtro no aporta nada
  }
  /* M03: texto del número de resultados, común a la lista, al panel del mapa y a la línea bajo el buscador. */
  function countText(items) {
    var q = state.q.trim();
    if (q && state.tooShort) { return 'Escribe al menos 2 letras para buscar'; }
    return items.length + (items.length === 1 ? ' negocio' : ' negocios') + (q ? ' para «' + q + '»' : '') + (state.approx && items.length ? ', coincidencia aproximada' : '');
  }
  var lastListQ = null;
  // Fundido corto de los resultados solo cuando cambia la búsqueda (no al seleccionar).
  function replay(list, q) { if (q === list._q) { return; } list._q = q; list.classList.remove('r-anim'); void list.offsetWidth; list.classList.add('r-anim'); }
  function renderList(items) {
    var browsing = !state.q.trim() && state.cat === 'Todos' && !state.openOnly && !state.modo;
    var promo = browsing && Cerca.patrocinios ? Cerca.patrocinios.tarjeta(state, byId) : '';
    el.list.innerHTML = promo + items.map(function (b, i) { return cardHtml(b, 'pick').replace('<li class="card', '<li style="--i:' + i + '" class="card'); }).join('') +
      // Invitación a comerciantes al final del recorrido (no es publicidad: es la forma de sumar negocios reales).
      (items.length && !state.q.trim() ? '<li class="invite"><p><strong>¿Tienes un negocio' + (C.municipioNombre ? ' en ' + esc(C.municipioNombre) : '') + '?</strong> Aparece en Nubi gratis, con local o sin él.</p><a class="btn btn--ghost" href="#/mi-negocio">Registrar mi negocio</a></li>' : '');
    el.count.textContent = countText(items);
    var off = items.filter(function (b) { return !S.hasPoint(b); }).length;
    el.count.textContent += browsing && off ? ' · ' + (items.length - off) + ' con local, ' + off + ' a domicilio o en línea' : '';
    renderOffmap(items);
    el.empty.hidden = items.length > 0;
    replay(el.list, state.q.trim() + '|' + state.cat + '|' + state.openOnly);
  }

  /* Aviso del mapa: los negocios sin punto público existen aunque no tengan pin; se dice cuántos y se ofrece verlos. */
  function renderOffmap(items) {
    var box = $('#offmap'); if (!box) { return; }
    var off = items.filter(function (b) { return !S.hasPoint(b); }).length;
    box.hidden = !off || !!state.q.trim() || !narrow() || state.pane !== 'map'; // en escritorio la lista está al lado y ya lo dice
    if (!off) { return; }
    $('#offmap-text').textContent = off === 1 ? '1 negocio atiende a domicilio o en línea y no aparece en el mapa.' : off + ' negocios atienden a domicilio o en línea y no aparecen en el mapa.';
  }
  /* ---------- M03: panel de resultados sobre el mapa (celular) ---------- */
  var sheet = 'hidden'; // hidden | min (solo cabecera) | peek (compacto) | full (expandido)
  function distLabel(b) {
    var u = map.user(); // solo si el usuario ya compartió su ubicación en esta visita y es precisa
    if (!u || !isFinite(u.accuracy) || u.accuracy > 100) { return ''; }
    return '<span class="ritem-dist">≈ ' + Cerca.geo.fmtDistance(Cerca.geo.distanceM(u, b)) + '<small>en línea recta</small></span>';
  }
  function ritemHtml(b, i) {
    var hit = state.hits && state.hits[b.id], pic = typeof b.photo === 'string' ? b.photo : '';
    return '<li style="--i:' + i + '"><button type="button" class="ritem' + (state.sel === b.id ? ' is-sel' : '') + '" data-rpick="' + b.id + '">' +
      (pic ? '<img class="ritem-pic" src="' + esc(pic) + '" alt="" loading="lazy" decoding="async">' : '<span class="card-ico pfv" style="' + Cerca.profiles.vars(b) + '">' + Cerca.profiles.icon(b.icon, 22) + '</span>') +
      '<span class="ritem-txt"><span class="ritem-name">' + esc(b.name) + '</span><span class="ritem-meta">' + esc(b.category) +
      (hit ? ' · <span class="sr-only">coincide con </span>' + esc(hit) : '') + '</span></span>' + distLabel(b) + '</button></li>';
  }
  function renderSheet(items) {
    var s = el.sheet, q = state.q.trim();
    if (!q) { sheet = 'hidden'; } else if (sheet === 'hidden') { sheet = 'peek'; }
    s.dataset.state = sheet;
    var open = sheet === 'peek' || sheet === 'full';
    el.wrap.classList.toggle('rs-on', sheet !== 'hidden');
    el.wrap.classList.toggle('rs-open', open);
    el.wrap.classList.toggle('rs-min', sheet === 'min');
    $('#rsheet-toggle').setAttribute('aria-expanded', open);
    var size = $('#rsheet-size'); size.setAttribute('aria-label', sheet === 'full' ? 'Reducir los resultados' : 'Ampliar los resultados');
    $('#rsheet-count').textContent = countText(items);
    $('#q-clear').hidden = !el.input.value; $('#q-live').hidden = !q;
    if (!q) { return; }
    var empty = !items.length && !state.tooShort;
    $('#rlist').innerHTML = state.tooShort ? '' : items.map(ritemHtml).join('');
    $('#rsheet-empty').hidden = !empty;
    if (empty) { $('#rsheet-empty-text').textContent = 'No encontré «' + q + '». Prueba con otra palabra' + (state.cat !== 'Todos' || state.openOnly ? ' o quita los filtros.' : '.'); }
    replay($('#rlist'), q + '|' + state.cat + '|' + state.openOnly);
    $('#q-live-text').textContent = countText(items);
  }
  function setSheet(st) { if (!state.q.trim()) { st = 'hidden'; } sheet = st; render(); }
  var I_CHEV_UP = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  var I_CHEV_DOWN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var I_WALK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="M9 21l2-6 3 3v3M7 12l3-4 4 1 2 4M11 15l-1-5"/></svg>';
  function renderSelCard(items) {
    var r = state.route;
    var b = state.sel && byId(state.sel);
    var visible = b && items.indexOf(b) !== -1;
    // Entrega A: con una ruta activa y la ficha cerrada, la ficha del destino queda minimizada (nunca desaparece).
    if (!visible && r) { b = byId(r.id); visible = !!b; }
    var hasRoute = !!(visible && r && r.id === b.id);
    var min = hasRoute && (r.min || state.sel !== r.id);
    el.selcard.hidden = !visible;
    el.selcard.classList.toggle('has-route', hasRoute);
    el.selcard.classList.toggle('is-min', min);
    if (!visible) { return; }
    if (min) {
      el.selcard.innerHTML = '<button type="button" class="selcard-min" data-card-expand aria-expanded="false">' +
        '<span class="selcard-min-txt"><span class="selcard-min-name">' + esc(b.name) + '</span>' +
        '<span class="selcard-min-route">' + I_WALK + '<span>Ruta activa · ≈ ' + fmtDuration(r.durationS) + ', ' + Cerca.geo.fmtDistance(r.distanceM) + '<span class="sr-only"> a pie</span></span></span></span>' +
        '<span class="selcard-chev">' + I_CHEV_UP + '</span><span class="sr-only">Mostrar la ficha completa</span></button>';
      return;
    }
    el.selcard.innerHTML = (hasRoute ? '<button type="button" class="selcard-toggle" data-card-min aria-expanded="true" aria-label="Minimizar la ficha">' + I_CHEV_DOWN + '</button>' : '') +
      '<h3>' + esc(b.name) + '</h3><p class="muted">' + esc(b.category) + ', ' + hoursText(b).toLowerCase() + '</p><p>' + esc(b.blurb) + '</p>' +
      '<div class="card-meta">' + statusHtml(b) + '</div><div class="selcard-actions"><a class="btn btn--accent" href="#/negocio/' + b.slug + '">Ver perfil</a>' + saveBtn(b) + '</div>' + routeHtml(b);
  }
  /* Módulo 01, Fase 3: ruta a pie. Distancia y duración vienen del servicio de rutas; nunca se calculan aquí. */
  function fmtDuration(s) { var m = Math.max(1, Math.round(s / 60)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
  function routeHtml(b) {
    var r = state.route;
    if (r && r.id === b.id) {
      return '<div class="route-info"><p class="route-sum"><strong>≈ ' + fmtDuration(r.durationS) + ' a pie</strong>, ' + Cerca.geo.fmtDistance(r.distanceM) + '</p>' +
        '<p class="route-note">' + esc(r.provider.attribution) + '. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Corregir el mapa</a></p>' +
        (b.demo ? '<p class="route-note">El destino es el punto de prueba de este negocio ficticio.</p>' : '') +
        '<div class="geo-msg-acts"><button type="button" class="geo-act" data-route-clear>Quitar ruta</button>' + mapsLink(b) + '</div></div>';
    }
    // D4/D10: sin punto público de atención (negocio por zona) nunca se ofrece ruta.
    if (!S.canRoute(b)) { return '<div class="route-ask"><p class="route-note">' + (S.attendMode(b) === 'en_linea' ? 'Atiende solo en línea' : 'Atiende en una zona general') + ', sin punto público: no hay ruta hasta este negocio.</p></div>'; }
    var busy = state.routing === b.id;
    return '<div class="route-ask"><button type="button" class="btn btn--ghost route-btn" data-route="' + b.id + '"' + (busy ? ' disabled aria-busy="true"' : '') + '>' +
      (busy ? 'Calculando ruta…' : 'Ruta a pie') + '</button>' + mapsLink(b) +
      '<p class="route-note">Para calcularla se envían tu ubicación y el destino al servicio público de rutas de OpenStreetMap (FOSSGIS, Alemania). «Abrir en Google Maps» usa la app o web de Google.</p></div>';
  }
  /* M04: navegación externa sin API ni clave (enlace oficial de Google Maps). Solo con punto público (D10). */
  function mapsLink(b) { var h = S.mapsHref(b); return h ? '<a class="geo-act route-ext" href="' + esc(h) + '" target="_blank" rel="noopener">Abrir en Google Maps</a>' : ''; }
  function render() {
    var items = filtered();
    // Si un filtro o la búsqueda ocultan el negocio seleccionado, se deselecciona; una ruta activa se conserva
    // (M03: buscar o cerrar resultados nunca la borra; solo «Quitar ruta» o elegir otro negocio).
    if (state.sel && items.map(function (b) { return b.id; }).indexOf(state.sel) === -1) { state.sel = null; }
    // Cerrar la ficha (sel = null) conserva la ruta: solo «Quitar ruta» o elegir otro negocio la quitan.
    if (state.route && state.sel && state.route.id !== state.sel) { state.route = null; map.clearRoute(); }
    renderList(items); renderSelCard(items); renderSheet(items); renderLaunchEmpty();
    var vis = new Set(items.map(function (b) { return b.id; }));
    var closed = new Set(DATA.filter(function (b) { return S.openAt(b, NOW) === false; }).map(function (b) { return b.id; }));
    map.update({ visible: vis, selected: state.sel, closed: closed });
    el.discover.dataset.pane = state.pane;
    $('#pane-list').setAttribute('aria-pressed', state.pane === 'list');
    $('#pane-map').setAttribute('aria-pressed', state.pane === 'map');
    return items;
  }
  /* Estado vacío del lanzamiento: todavía no hay ningún negocio publicado (distinto de «sin resultados» por un
     filtro). Nunca se rellenan datos ficticios. Si además falló la carga y no hay copia, se dice con claridad. */
  function renderLaunchEmpty() {
    var box = $('#launch-empty'); if (!box) { return; }
    var none = DATA.length === 0, sinRed = none && S.lastError && S.lastError();
    box.hidden = !none;
    if (!none) { return; }
    $('#launch-empty-t').textContent = sinRed ? 'No pudimos cargar los negocios' : 'Muy pronto verás aquí los negocios de Roldanillo';
    $('#launch-empty-text').textContent = sinRed
      ? 'Revisa tu conexión e intenta de nuevo. El mapa sigue disponible.'
      : 'Nubi está empezando: los primeros negocios se están registrando y cada uno pasa por una revisión antes de aparecer. Mientras tanto, puedes recorrer el mapa y ubicarte.';
    el.empty.hidden = true;  // en la lista no se muestra «Sin resultados»: el aviso de arriba lo explica
    $$('#chips button').forEach(function (b) { b.disabled = true; });  // filtros sin efecto mientras no haya negocios
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
    if (state.route && state.route.id !== id) { clearRoute(); } // la ruta corresponde a otro negocio
    if (sheet === 'peek' || sheet === 'full') { sheet = 'min'; } // un solo panel abajo: se recogen los resultados y se ve la ficha
    state.sel = id; render();
    if (!fromMap) { map.select(id); }
  }
  function go(hash) { if (location.hash !== hash) { location.hash = hash; } else { route(); } }
  function showMap(id) {
    var nb = id && byId(id); if (nb && !S.hasPoint(nb)) { go('#/negocio/' + nb.slug); return; } // sin punto público no hay nada que ver en el mapa
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
      var url = location.href.split('#')[0] + '#/negocio/' + b.slug, data = { title: b.name, text: b.name + ' en ' + C.municipioNombre + (b.demo ? ' (negocio de prueba)' : ''), url: url };
      if (navigator.share) { navigator.share(data).catch(function () { /* el usuario canceló */ }); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(url).then(function () { toast('Enlace copiado.'); }, function () { toast('Copia este enlace: ' + url); }); }
      else { toast('Copia este enlace: ' + url); }
    }
  }
  var VIEWS = { home: 'Explorar', saved: 'Guardados', owner: 'Tu negocio', settings: 'Ajustes', profile: '', admin: 'Moderación', privacy: 'Privacidad y términos' };
  function route() {
    var h = location.hash || '#/';
    // La vista previa del borrador ahora es el paso 6 del registro (formulario único).
    if (h === '#/mi-negocio/vista') { history.replaceState(null, '', '#/mi-negocio'); h = '#/mi-negocio'; }
    var m = /^#\/negocio\/([\w-]+)$/.exec(h), b = m && S.resolve(m[1]); // slug estable; los números antiguos de la demo siguen funcionando
    var prev = state.view;
    state.view = b ? 'profile' : h === '#/guardados' ? 'saved' : h === '#/mi-negocio' ? 'owner' :h === '#/ajustes' ? 'settings' : h === '#/admin' ? 'admin' : h === '#/privacidad' ? 'privacy' : 'home';
    state.profile = b || null;
    // Enlace compartido a un negocio que ya no está publicado (retirado, suspendido o eliminado): explicarlo.
    if (m && !b) { toast('Ese negocio ya no está publicado en Nubi.'); }
    Object.keys(VIEWS).forEach(function (v) { $('#view-' + v).hidden = v !== state.view; });
    var navKey = state.view === 'profile' ? 'home' :state.view === 'admin' || state.view === 'privacy' ? 'settings' : state.view;
    $$('[data-nav]').forEach(function (a) { if (a.dataset.nav === navKey) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); } });
    document.title = (b ? b.name : VIEWS[state.view]) + ' · ' + C.appName;
    if (state.view === 'profile') { renderProfile(b); }
    if (state.view === 'saved') { renderSaved(); }
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
  el.sheet = $('#rsheet'); el.wrap = $('.mapwrap'); el.sheet.hidden = false; // el estado visual lo da data-state
  // Alturas para el panel (porcentaje del mapa) y para subir la atribución del mapa por encima del panel.
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      el.wrap.style.setProperty('--map-h', el.wrap.clientHeight + 'px');
      el.wrap.style.setProperty('--rs-h', el.sheet.offsetHeight + 'px');
    }).observe(el.wrap);
    new ResizeObserver(function () { el.wrap.style.setProperty('--rs-h', el.sheet.offsetHeight + 'px'); }).observe(el.sheet);
  }
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
    container: $('#map'), businesses: DATA.filter(S.hasPoint), /* sin punto público no hay marcador (D10) */ config: C, onSelect: function (id) { pick(id, true); },
    onManualMove: function () { onManualMove(); },
    onBackgroundClick: function () {
      if (sheet === 'peek' || sheet === 'full') { setSheet('min'); return; } // M03: tocar el mapa recoge los resultados (la búsqueda sigue)
      if (state.sel) { cancelAutoMin(); state.sel = null; animateCard(render); } }, // ajuste UX: tocar el fondo cierra la ficha (con ruta activa queda minimizada)
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

    function clearUser() { stopTracking(); clearRoute(); here = null; lastFix = null; map.clearUser(); btn.classList.remove('is-on'); setBusy(false); show('Quitamos tu ubicación del mapa.', { autoHide: 3000 }); }
    /* Fase 3: la ruta necesita tu ubicación; si aún no la tenemos se pide ahora (el usuario pulsó «Ruta a pie»). */
    function ensureLocation() {
      if (here) { return Promise.resolve(here); }
      setBusy(true); show('Buscando tu ubicación para calcular la ruta…');
      return Cerca.geo.locate().then(function (u) {
        here = u; btn.classList.add('is-on'); setBusy(false); map.setUser(u); hide(); return u;
      }, function (err) { setBusy(false); show(err.message, { error: true }); throw err; });
    }
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
    return { stopTracking: stopTracking, tracking: function () { return tracking; }, ensureLocation: ensureLocation, show: show, hide: hide };
  })();

  /* ---------- Módulo 01, Fase 3: ruta a pie hacia el negocio seleccionado ---------- */
  function clearRoute() { cancelAutoMin(); if (state.route) { state.route = null; map.clearRoute(); renderSelCard(filtered()); } }

  /* Entrega A: ficha minimizable durante la ruta. Minimizar = reducir la ficha, nunca ocultarla. */
  var AUTO_MIN_MS = 2500, minTimer = null;
  function cancelAutoMin() { clearTimeout(minTimer); minTimer = null; }
  function scheduleAutoMin(id) {
    cancelAutoMin();
    minTimer = setTimeout(function () {
      minTimer = null;
      var r = state.route; // solo si sigue siendo la misma ruta, abierta y sin que el usuario la haya expandido
      if (r && r.id === id && state.sel === id && !r.min && !r.autoOff) { setCardMin(true); }
    }, AUTO_MIN_MS);
  }
  function animateCard(fn) {
    var card = el.selcard;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || card.hidden || !card.animate) { fn(); return; }
    var h0 = card.offsetHeight; fn();
    if (card.hidden) { return; }
    var h1 = card.offsetHeight; if (h0 === h1) { return; }
    card.classList.add('is-anim');
    var a = card.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
    Array.prototype.forEach.call(card.children, function (c) { c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 80, fill: 'backwards' }); });
    a.onfinish = a.oncancel = function () { card.classList.remove('is-anim'); };
  }
  function setCardMin(min) {
    var r = state.route; if (!r) { return; }
    cancelAutoMin();
    var hadFocus = el.selcard.contains(document.activeElement);
    if (!min) { r.autoOff = true; state.sel = r.id; } // expandida por el usuario: no se vuelve a minimizar sola en esta ruta
    r.min = min;
    animateCard(render);
    if (hadFocus) { var f = el.selcard.querySelector(min ? '[data-card-expand]' : '[data-card-min]'); if (f) { f.focus(); } }
  }
  // Tocar o usar el teclado en la ficha durante la espera cancela la minimización automática.
  ['pointerdown', 'keydown'].forEach(function (t) { $('#selcard').addEventListener(t, cancelAutoMin); });

  function requestRoute(id) {
    var b = byId(id); if (!b || state.routing || !S.canRoute(b)) { return; } // también se bloquea aquí, no solo en la interfaz
    cancelAutoMin();
    state.routing = id; renderSelCard(filtered());
    geoCtl.ensureLocation().then(function (u) {
      return Cerca.routing.route(u, { lat: b.lat, lng: b.lng }).then(function (r) {
        if (state.sel !== id) { return; } // el usuario eligió otro negocio mientras esperaba
        if (!map.isReal()) { geoCtl.show('La ruta solo se puede dibujar sobre el mapa real, que no cargó.', { error: true }); return; }
        state.route = { id: id, distanceM: r.distanceM, durationS: r.durationS, provider: r.provider };
        state.routing = null; renderSelCard(filtered()); // tarjeta compacta antes de encuadrar
        map.setRoute(r.coords, { bottom: el.selcard.offsetHeight + 24 });
        geoCtl.hide();
        scheduleAutoMin(id); // solo tras una ruta válida y dibujada
      }, function (err) {
        // Si el servicio de rutas falla, se ofrece la navegación externa (M04).
        var acts = err.code === 'timeout' || err.code === 'rate' || err.code === 'unavailable' || err.code === 'offline' ? [['Intentar de nuevo', function () { geoCtl.hide(); requestRoute(id); }]] : [];
        if (S.mapsHref(b) && err.code !== 'offline') { acts.push(['Abrir en Google Maps', function () { window.open(S.mapsHref(b), '_blank', 'noopener'); }]); }
        geoCtl.show(err.message, { error: true, acts: acts });
      });
    }, function () { /* el mensaje de ubicación ya se mostró */ }).then(function () { state.routing = null; renderSelCard(filtered()); });
  }
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-route]'); if (r) { requestRoute(+r.dataset.route); return; }
    if (e.target.closest('[data-route-clear]')) { clearRoute(); return; }
    if (e.target.closest('[data-card-expand]')) { setCardMin(false); return; }
    if (e.target.closest('[data-card-min]')) { setCardMin(true); }
  });

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
    if (c.id === 'open-only') { state.openOnly = !state.openOnly; } else if (c.dataset.modo) { state.modo = state.modo === c.dataset.modo ? null : c.dataset.modo; } else { state.cat = c.dataset.cat; }
    renderChips(); afterFilterChange();
  });
  // En el celular (lista a pantalla completa) o si el negocio no tiene punto en el mapa, tocar la tarjeta abre su ficha.
  el.list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]'); if (!b) { return; }
    var n = byId(+b.dataset.pick);
    if (n && (narrow() || !S.hasPoint(n))) { go('#/negocio/' + n.slug); return; }
    pick(+b.dataset.pick, false);
  });
  $('#saved-list').addEventListener('click', function (e) { var b = e.target.closest('[data-map]'); if (b) { showMap(+b.dataset.map); } });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-save]'); if (b) { toggleSave(+b.dataset.save); } });
  /* M03: búsqueda en vivo con una espera breve, limpiar (botón y Esc) y panel de resultados. */
  var SEARCH_WAIT = 120, searchTimer = null;
  function applySearch() {
    clearTimeout(searchTimer); searchTimer = null;
    if (state.q === el.input.value) { return; }
    state.q = el.input.value;
    if (afterFilterChange().length && state.q.trim()) { mascot('search'); }
  }
  function clearSearch() { el.input.value = ''; applySearch(); }
  function narrow() { return window.matchMedia('(max-width: 900px)').matches; }
  // En el celular, tras buscar, se baja hasta el mapa para ver el panel por encima de la navegación inferior.
  function showResults() {
    applySearch(); el.input.blur();
    if (!state.q.trim() || !narrow() || state.pane !== 'map') { return; }
    setSheet('peek');
    var nav = $('.nav'), navH = nav && getComputedStyle(nav).position === 'fixed' ? nav.offsetHeight : 0;
    var r = el.wrap.getBoundingClientRect(), target = window.scrollY + r.bottom - (window.innerHeight - navH - 8);
    if (target > window.scrollY) { window.scrollTo({ top: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  }
  el.input.addEventListener('input', function () {
    $('#q-clear').hidden = !el.input.value;
    clearTimeout(searchTimer); searchTimer = setTimeout(applySearch, SEARCH_WAIT);
  });
  el.input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el.input.value) { e.preventDefault(); clearSearch(); } });
  $('#search-form').addEventListener('submit', function (e) { e.preventDefault(); showResults(); });
  $('#q-clear').addEventListener('click', function () { clearSearch(); el.input.focus(); });
  // La línea «N negocios · Ver resultados» solo se ve mientras se escribe (con el teclado abierto el panel queda abajo).
  var hero = $('.hero');
  el.input.addEventListener('focus', function () { hero.classList.add('is-typing'); });
  el.input.addEventListener('blur', function () { hero.classList.remove('is-typing'); });
  $('#q-live-go').addEventListener('pointerdown', function (e) { e.preventDefault(); }); // no quitar el foco antes del clic
  $('#q-live-go').addEventListener('click', showResults);
  $('#rsheet-toggle').addEventListener('click', function () { setSheet(sheet === 'min' ? 'peek' : 'min'); });
  $('#rsheet-size').addEventListener('click', function () { setSheet(sheet === 'full' ? 'peek' : 'full'); });
  $('#rsheet-clear').addEventListener('click', clearSearch);
  $('#rsheet-empty-clear').addEventListener('click', clearSearch);
  $('#rlist').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rpick]'); if (!b) { return; }
    pick(+b.dataset.rpick, false); // centra el mapa, abre la ficha y recoge el panel (la ruta activa se conserva si es de este negocio)
  });
  document.addEventListener('nubi:patrocinios', function () { if (state.view === 'home') { render(); } });
  $('#offmap-go').addEventListener('click', function () { state.modo = null; state.pane = 'list'; renderChips(); render(); var l = $('#list .card'); if (l) { l.scrollIntoView({ block: 'nearest' }); } });
  $('#pane-list').addEventListener('click', function () { state.pane = 'list'; render(); if (geoCtl.tracking()) { geoCtl.stopTracking('Detuvimos el seguimiento al pasar a la lista.'); } });
  $('#pane-map').addEventListener('click', function () { state.pane = 'map'; if (state.q.trim() && sheet === 'hidden') { sheet = 'peek'; } render(); map.resize(); });
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
    mapState: function () { return { real: map.isReal(), accuracyLayer: map.hasAccuracy(), user: map.user(), center: map.center(), tracking: geoCtl.tracking(), routeLayer: map.hasRoute(), route: state.route }; }, // solo para pruebas
    sheetState: function () { return sheet; }, // solo para pruebas
    cardState: function () { return { visible: !el.selcard.hidden, min: el.selcard.classList.contains('is-min'), timer: !!minTimer, sel: state.sel }; }, // solo para pruebas
    setAutoMinMs: function (ms) { var p = AUTO_MIN_MS; AUTO_MIN_MS = ms; return p; }, // solo para pruebas (acortar la espera)
    data: DATA, categories: CATS.slice(1), isOpen: isOpen, hoursText: hoursText, byId: byId,
    openLabel: function (b) { var o = S.openAt(b, NOW); return o === true ? 'abierto ahora' : o === false ? 'cerrado ahora' : hoursText(b).toLowerCase(); },
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
  document.dispatchEvent(new Event('nubi:app-lista')); // el asistente y el registro arrancan después
});
