/* Capa de datos de Nubi (Etapa 1, T1 y T2). Los componentes visuales (mapa, lista, fichas, buscador,
   asistente) leen los negocios SOLO a través de Cerca.store, nunca de una fuente concreta.
   Hoy la fuente es el adaptador «demo» (js/data.js, negocios ficticios). Más adelante se añadirá un
   adaptador «supabase» con la misma forma de datos; ver docs/arquitectura/E1-modelo-datos.md.

   Forma de un negocio (equivale a la vista pública negocios_publicos):
   { id        número de sesión, solo para la interfaz (no se guarda en ningún lado)
     uid       identificador estable (uuid en el servidor; «demo-…» en la demo)
     slug      para las direcciones #/negocio/<slug>
     legacyId  número antiguo de la demo (solo para direcciones y favoritos guardados antes)
     status    'publicado' | … (la lista pública solo devuelve 'publicado')
     demo      true si es ficticio
     municipio, name, category, kind, kindLabel, palette, icon, since, blurb, description,
     keywords[], tags[], products[], story, news, moved, fresh, delivery, payments[], updatedAt
     location  { mode: 'local', lat, lng, address, demoPoint } | { mode: 'zona', zone: { id, name } }
     lat, lng  copia del punto público (null si no hay punto: sin pin ni rutas)
     hours     { mode: 'fijo'|'con_cita'|'variable'|'desconocido', week: [7 días × [{ from:'HH:MM', to:'HH:MM' }]], exceptions: [] }
     contacts  [{ kind: 'whatsapp'|'telefono'|'correo'|'instagram'|'facebook'|'tiktok'|'web', value }] }
   Semana: índice 0 = domingo … 6 = sábado. */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var MODES = ['fijo', 'con_cita', 'variable', 'desconocido'];
  var CONTACT_KINDS = ['whatsapp', 'telefono', 'correo', 'instagram', 'facebook', 'tiktok', 'web'];

  function pad(h) { return (h < 10 ? '0' : '') + h + ':00'; }
  function toMin(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s)); return m ? (+m[1]) * 60 + (+m[2]) : NaN; }
  function slugify(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  /* Horario: acepta el formato nuevo o el antiguo { from: 5, to: 19 } (borrador del editor) sin modificar el objeto. */
  function hoursOf(b) {
    var h = b && b.hours;
    if (h && Array.isArray(h.week)) { return h; }
    if (h && isFinite(h.from) && isFinite(h.to)) {
      var slot = [{ from: pad(+h.from), to: pad(+h.to) }], week = [];
      for (var i = 0; i < 7; i++) { week.push(slot); }
      return { mode: 'fijo', week: week, exceptions: [] };
    }
    return { mode: 'desconocido', week: [[], [], [], [], [], [], []], exceptions: [] };
  }
  /* ¿Abierto en el momento t = { day: 0-6, min: minutos desde medianoche }? true, false o null (no se sabe). */
  function openAt(b, t) {
    var h = hoursOf(b);
    if (h.mode !== 'fijo') { return null; }
    var inSlot = function (s, min, yesterday) {
      var f = toMin(s.from), to = toMin(s.to); if (!isFinite(f) || !isFinite(to)) { return false; }
      if (to > f) { return !yesterday && min >= f && min < to; }
      return yesterday ? min < to : min >= f; // franja que cruza la medianoche
    };
    var today = h.week[t.day] || [], prev = h.week[(t.day + 6) % 7] || [];
    return today.some(function (s) { return inSlot(s, t.min, false); }) || prev.some(function (s) { return inSlot(s, t.min, true); });
  }
  function fmtTime(s) { var m = toMin(s), h = Math.floor(m / 60) % 24, mm = m % 60; return (h % 12 === 0 ? 12 : h % 12) + ':' + (mm < 10 ? '0' : '') + mm + ' ' + (h >= 12 ? 'p. m.' : 'a. m.'); }
  function hoursLabel(b, t) {
    var h = hoursOf(b);
    if (h.mode === 'con_cita') { return 'Atiende con cita previa'; }
    if (h.mode === 'variable') { return 'Horario variable'; }
    if (h.mode !== 'fijo') { return 'Horario no publicado'; }
    var slots = h.week[t.day] || [];
    if (!slots.length) { return 'Hoy cerrado'; }
    return 'Hoy ' + slots.map(function (s) { return fmtTime(s.from) + ' a ' + fmtTime(s.to); }).join(' y ');
  }

  /* Normaliza un negocio de cualquier adaptador a la forma única. No inventa datos: lo que falta queda vacío. */
  function normalize(raw, handle) {
    var b = Object.assign({}, raw);
    b.id = handle;
    b.slug = b.slug || slugify(b.name || 'negocio');
    b.uid = b.uid || ('local-' + b.slug);
    b.status = b.status || 'borrador';
    b.keywords = b.keywords || []; b.tags = b.tags || []; b.products = b.products || []; b.payments = b.payments || [];
    var loc = b.location || (isFinite(b.lat) && isFinite(b.lng) ? { mode: 'local', lat: b.lat, lng: b.lng, address: b.address || null } : null);
    if (loc && loc.mode === 'local' && isFinite(loc.lat) && isFinite(loc.lng)) { b.location = loc; b.lat = loc.lat; b.lng = loc.lng; }
    else { b.location = loc && loc.mode === 'zona' ? { mode: 'zona', zone: loc.zone || null } : loc && loc.mode === 'en_linea' ? { mode: 'en_linea' } : null; b.lat = null; b.lng = null; } // sin punto público: sin pin ni rutas
    b.hours = hoursOf(b);
    if (MODES.indexOf(b.hours.mode) === -1) { b.hours = hoursOf(null); }
    // Solo contactos válidos (normalizados): nunca se muestra un botón con un dato inválido.
    b.contacts = (b.contacts || []).filter(function (c) { return c && CONTACT_KINDS.indexOf(c.kind) !== -1 && c.value && normalizeContact(c.kind, c.value).value; })
      .map(function (c) { return { kind: c.kind, value: normalizeContact(c.kind, c.value).value }; });
    return b;
  }
  /* Contactos (Entrega B): normaliza lo que escribe el comerciante y arma enlaces directos.
     Mismas reglas que la restricción contacto_valido de la base de datos. Devuelve { value } o { error }. */
  var CONTACT_RULES = {
    whatsapp: 'tel', telefono: 'tel',
    correo: function (v) { v = v.trim().toLowerCase(); return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v) ? { value: v } : { error: 'Correo no válido. Ejemplo: nombre@correo.com' }; },
    instagram: function (v) { v = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, ''); return /^[A-Za-z0-9._]{1,30}$/.test(v) ? { value: v } : { error: 'Escribe solo el usuario, por ejemplo panaderia.laespiga' }; },
    tiktok: function (v) { v = v.trim().replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '').replace(/^@/, '').replace(/[/?#].*$/, ''); return /^[A-Za-z0-9._]{1,30}$/.test(v) ? { value: v } : { error: 'Escribe solo el usuario, por ejemplo laespiga' }; },
    facebook: function (v) { v = v.trim().replace(/^https?:\/\/(www\.|m\.)?facebook\.com\//i, '').replace(/[/?#].*$/, ''); return /^[A-Za-z0-9.-]{1,80}$/.test(v) ? { value: v } : { error: 'Escribe el nombre de la página, por ejemplo LaEspigaRoldanillo' }; },
    web: function (v) { v = v.trim(); if (!/^[a-z]+:\/\//i.test(v)) { v = 'https://' + v; } return /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/[^\s<>"]*)?$/.test(v) ? { value: v } : { error: 'Dirección web no válida (debe ser https). Ejemplo: https://laespiga.com' }; }
  };
  function normalizeContact(kind, raw) {
    var r = CONTACT_RULES[kind], v = String(raw || '');
    if (!v.trim()) { return { value: '' }; }
    if (r === 'tel') {
      var d = v.replace(/\D/g, '');
      if (d.length === 12 && d.slice(0, 2) === '57') { d = d.slice(2); }
      return /^[36]\d{9}$/.test(d) ? { value: '+57' + d } : { error: 'Número colombiano de 10 dígitos, por ejemplo 300 123 4567' };
    }
    return r ? r(v) : { error: 'Tipo de contacto no válido' };
  }
  function contactHref(kind, value) {
    var n = normalizeContact(kind, value); if (!n.value) { return null; }
    var v = n.value;
    return ({ whatsapp: 'https://wa.me/' + v.slice(1), telefono: 'tel:' + v, correo: 'mailto:' + v, instagram: 'https://instagram.com/' + v,
      facebook: 'https://facebook.com/' + v, tiktok: 'https://www.tiktok.com/@' + v, web: v })[kind] || null;
  }
  // Enlace oficial «Maps URLs» de Google (sin clave). A pie; solo para negocios con punto público.
  function mapsHref(b) { return hasPoint(b) ? 'https://www.google.com/maps/dir/?api=1&destination=' + b.lat + ',' + b.lng + '&travelmode=walking' : null; }
  function hasPoint(b) { return !!(b && b.location && b.location.mode === 'local' && isFinite(b.lat) && isFinite(b.lng)); }
  /* Cómo atiende un negocio (fuente única para lista, filtros, mapa y ficha):
     'local' = recibe clientes en un punto público (pin y rutas); 'zona' = a domicilio o en una zona de cobertura
     (sin punto ni dirección); 'en_linea' = solo por redes, WhatsApp o web. La cobertura no es la ubicación del negocio. */
  var ATIENDE = { local: 'Con local', zona: 'A domicilio o por zona', en_linea: 'En línea' };
  function attendMode(b) { return hasPoint(b) ? 'local' : b && b.location && b.location.mode === 'en_linea' ? 'en_linea' : 'zona'; }
  function attendLabel(b) {
    var m = attendMode(b);
    if (m === 'local') { return b.location.address ? 'Con local · ' + b.location.address : 'Con local'; }
    if (m === 'en_linea') { return b.delivery ? 'En línea · hace domicilios' : 'En línea'; }
    var z = b.location && b.location.zone && b.location.zone.name;
    return (b.delivery ? 'A domicilio' : 'Atiende por zona') + (z ? ' · ' + z : '');
  }

  /* ---------- Conversión desde la base de datos (T8) ----------
     Fila de negocios_publicos + horarios + contactos + ofertas + medios → forma única de negocio. */
  var CFG = (window.CERCA_CONFIG || {}).supabase;
  function hhmm(t) { return String(t || '').slice(0, 5); }
  function mediaUrl(ruta) { return CFG ? CFG.url + '/storage/v1/object/public/medios/' + ruta : ''; }
  function precioTexto(o) { return o.precio_texto || (o.precio_cop != null ? '$' + Number(o.precio_cop).toLocaleString('es-CO') : ''); }
  function kindInfo(k) { var K = (Cerca.profiles && Cerca.profiles.KINDS) || {}; return K[k] || K.tienda || { label: '', icon: 'store' }; }
  function fromDb(n, rel) {
    var week = [[], [], [], [], [], [], []];
    (rel.horarios || []).forEach(function (h) { if (week[h.dia]) { week[h.dia].push({ from: hhmm(h.abre), to: hhmm(h.cierra) }); } });
    var med = rel.medios || [], pick = function (t) { return med.filter(function (m) { return m.tipo === t; }).map(function (m) { return mediaUrl(m.ruta); }); };
    var k = kindInfo(n.tipo);
    return {
      uid: n.id, slug: n.slug, status: 'publicado', demo: false, municipio: n.municipio_id,
      name: n.nombre, category: n.categoria, kind: n.tipo || 'tienda', kindLabel: k.label, palette: n.paleta, icon: n.icono || k.icon, since: n.desde,
      blurb: n.frase || '', description: n.descripcion || '', story: n.historia || '', news: n.novedad ? { when: 'Novedad', text: n.novedad } : null,
      keywords: n.palabras_clave || [], tags: n.etiquetas || [],
      products: (rel.ofertas || []).map(function (o) { return { n: o.nombre, d: o.detalle || '', p: precioTexto(o), i: o.icono || undefined }; }),
      location: n.modo_ubicacion === 'local' ? { mode: 'local', lat: n.lat, lng: n.lng, address: n.direccion_publica || null } : n.modo_ubicacion === 'en_linea' ? { mode: 'en_linea' } : { mode: 'zona', zone: { name: n.zona_nombre } },
      hours: { mode: n.modo_horario || 'desconocido', week: week, exceptions: [] },
      contacts: (rel.contactos || []).map(function (c) { return { kind: c.tipo, value: c.valor }; }),
      delivery: n.domicilio, payments: n.medios_pago || [], updatedAt: n.actualizado_en,
      logo: pick('logo')[0] || null, cover: pick('portada')[0] || null, gallery: pick('galeria'), moved: false, fresh: false
    };
  }
  /* Revisión (revisiones.datos) → forma única, para la vista previa del registro (T6). */
  function fromDatos(d, extra) {
    d = d || {}; extra = extra || {};
    var u = d.ubicacion || {}, h = d.horario || {}, week = [[], [], [], [], [], [], []];
    (h.semana || []).forEach(function (s) { if (week[s.dia]) { week[s.dia].push({ from: s.abre, to: s.cierra }); } });
    var k = kindInfo(d.tipo), url = function (r) { return extra.mediaUrl ? extra.mediaUrl(r) : mediaUrl(r); };
    var med = d.medios || [], pick = function (t) { return med.filter(function (m) { return m.tipo === t; }).map(function (m) { return m.preview || url(m.ruta); }); };
    return {
      id: 'revision', uid: 'revision', slug: 'revision', status: 'borrador', demo: false, draft: true,
      name: d.nombre || 'Nombre de tu negocio', category: d.categoria || k.category || '', kind: d.tipo || 'tienda', kindLabel: k.label, palette: d.paleta, icon: d.icono || k.icon, since: d.desde,
      blurb: d.frase || '', description: d.descripcion || '', story: d.historia || '', news: d.novedad ? { when: 'Novedad', text: d.novedad } : null,
      keywords: d.palabras_clave || [], tags: d.etiquetas || [],
      products: (d.ofertas || []).filter(function (o) { return o && o.nombre; }).map(function (o) { return { n: o.nombre, d: o.detalle || '', p: precioTexto(o), i: o.icono }; }),
      location: u.modo === 'local' ? { mode: 'local', lat: u.lat, lng: u.lng, address: u.direccion || null } : u.modo === 'zona' ? { mode: 'zona', zone: { name: extra.zonaNombre || 'Zona' } } : u.modo === 'en_linea' ? { mode: 'en_linea' } : null,
      hours: { mode: h.modo || 'desconocido', week: week, exceptions: [] },
      contacts: (d.contactos || []).map(function (c) { return { kind: c.tipo, value: c.valor }; }),
      delivery: d.domicilio, payments: d.medios_pago || [], logo: pick('logo')[0] || null, cover: pick('portada')[0] || null, gallery: pick('galeria'), moved: false, fresh: true
    };
  }

  /* Lectura pública con la clave publicable (sin librería: fetch a la API REST, protegida por RLS). */
  function rest(path) {
    return fetch(CFG.url + '/rest/v1/' + path, { headers: { apikey: CFG.publishableKey, Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); });
  }
  function loadSupabase() {
    if (!CFG) { return Promise.reject(new Error('sin configuración')); }
    var mun = (window.CERCA_CONFIG && window.CERCA_CONFIG.municipio) || '';
    return rest('negocios_publicos?select=*&municipio_id=eq.' + encodeURIComponent(mun) + '&order=nombre').then(function (rows) {
      if (!rows.length) { return []; }
      var ids = 'negocio_id=in.(' + rows.map(function (r) { return r.id; }).join(',') + ')';
      return Promise.all([
        rest('horarios?select=negocio_id,dia,abre,cierra&' + ids + '&order=dia,abre'),
        rest('contactos?select=negocio_id,tipo,valor&' + ids),
        rest('ofertas?select=negocio_id,nombre,detalle,precio_cop,precio_texto,icono,orden&' + ids + '&order=orden'),
        rest('medios?select=negocio_id,tipo,ruta,orden&' + ids + '&order=orden')
      ]).then(function (r) {
        var by = function (list, id) { return list.filter(function (x) { return x.negocio_id === id; }); };
        return rows.map(function (n) { return fromDb(n, { horarios: by(r[0], n.id), contactos: by(r[1], n.id), ofertas: by(r[2], n.id), medios: by(r[3], n.id) }); });
      });
    });
  }
  /* M04: última lista pública aprobada guardada en este dispositivo, para verla sin conexión.
     Solo datos públicos (los mismos que cualquiera ve); caduca a los 7 días. */
  var PUB_KEY = 'nubi.publicos.v1', PUB_MAX_MS = 7 * 24 * 3600 * 1000, fromCache = false;
  function savePublic(list) { try { localStorage.setItem(PUB_KEY, JSON.stringify({ t: Date.now(), mun: (window.CERCA_CONFIG || {}).municipio, list: list })); } catch (e) { /* sin espacio: se ignora */ } }
  function cachedPublic() {
    try {
      var c = JSON.parse(localStorage.getItem(PUB_KEY));
      if (c && Array.isArray(c.list) && Date.now() - c.t < PUB_MAX_MS && c.mun === (window.CERCA_CONFIG || {}).municipio) { fromCache = true; return c.list; }
    } catch (e) { /* nada */ }
    return [];
  }
  function loadPublic() {
    return withTimeout(loadSupabase(), 6000).then(function (l) { lastError = null; fromCache = false; savePublic(l); return l; }, function (e) { lastError = e; return cachedPublic(); });
  }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('tiempo')); }, ms); })]); }

  /* ---------- Adaptadores ---------- */
  var lastError = null;
  var adapters = {
    demo: { name: 'Datos de demostración', list: function () { return window.CERCA_DEMO || []; } },
    // Sin conexión, ambos usan la última lista aprobada guardada en el dispositivo (si tiene menos de 7 días).
    supabase: { name: 'Negocios aprobados (Supabase)', load: loadPublic },
    // Piloto con demostración: los negocios reales aprobados + los 10 ficticios (marcados).
    mixto: { name: 'Aprobados + demostración', load: function () { return loadPublic().then(function (real) { return real.concat(window.CERCA_DEMO || []); }); } }
  };

  var all = [], byHandle = {}, bySlug = {}, byUid = {}, byLegacy = {};
  // Normaliza y deja solo lo aprobado (público). Función pura: no toca el índice.
  function publicRows(rows) {
    // Número de sesión: la demo conserva su número antiguo; los demás usan 1001, 1002… (nunca chocan).
    return rows.map(function (raw, i) { return normalize(raw, raw.legacyId != null ? raw.legacyId : 1001 + i); }).filter(function (b) { return b.status === 'publicado'; });
  }
  function index(rows) {
    all = publicRows(rows); byHandle = {}; bySlug = {}; byUid = {}; byLegacy = {};
    all.forEach(function (b) {
      byHandle[b.id] = b; bySlug[b.slug] = b; byUid[b.uid] = b;
      if (b.legacyId != null) { byLegacy[b.legacyId] = b; }
    });
    return all;
  }
  var q = new URLSearchParams(location.search).get('datos'); // para probar: ?datos=demo|supabase|mixto
  var source = (q && adapters[q]) ? q : ((window.CERCA_CONFIG && window.CERCA_CONFIG.dataSource) || 'demo');
  var adapter = adapters[source] || adapters.demo;
  if (!CFG && source !== 'demo') { source = 'demo'; adapter = adapters.demo; }
  // La demo es síncrona. Los adaptadores remotos cargan antes de que la app pinte (app.js espera ready()).
  if (adapter.list) { index(adapter.list()); }
  var readyP = adapter.list ? Promise.resolve(all) : adapter.load().then(index, function (e) { lastError = e; return index([]); });

  /* ---------- Favoritos (solo en este dispositivo) ----------
     Antes: 'cerca.saved' = [1, 5] (números de la demo). Ahora: 'nubi.favoritos' = [uid, …].
     Migración no destructiva: la clave antigua no se borra; los uid que hoy no están publicados se conservan. */
  var FAV_OLD = 'cerca.saved', FAV = 'nubi.favoritos';
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function storedUids() {
    var v = readJSON(FAV);
    if (Array.isArray(v)) { return v.filter(function (x) { return typeof x === 'string'; }); }
    var old = readJSON(FAV_OLD), uids = [];
    if (Array.isArray(old)) {
      old.forEach(function (n) { var b = byLegacy[n]; if (b && uids.indexOf(b.uid) === -1) { uids.push(b.uid); } });
      try { localStorage.setItem(FAV, JSON.stringify(uids)); } catch (e) { /* sin almacenamiento: dura esta visita */ }
    }
    return uids;
  }
  var favorites = {
    load: function () { return storedUids().map(function (u) { return byUid[u] && byUid[u].id; }).filter(Boolean); },
    save: function (handles) {
      var visible = handles.map(function (h) { return byHandle[h] && byHandle[h].uid; }).filter(Boolean);
      var hidden = storedUids().filter(function (u) { return !byUid[u]; }); // no se pierden favoritos de negocios no visibles hoy
      try { localStorage.setItem(FAV, JSON.stringify(visible.concat(hidden))); } catch (e) { /* sin almacenamiento */ }
    },
    KEY: FAV, OLD_KEY: FAV_OLD
  };

  Cerca.store = {
    source: source, sourceName: adapter.name,
    ready: function () { return readyP; },
    list: function () { return all; },
    get: function (handle) { return byHandle[handle] || null; },
    // Resuelve lo que llega en la dirección: slug, uid o número antiguo de la demo.
    resolve: function (key) { key = String(key); return bySlug[key] || byUid[key] || (/^\d+$/.test(key) ? byLegacy[+key] : null) || null; },
    hasPoint: hasPoint, canRoute: hasPoint, mapsHref: mapsHref, attendMode: attendMode, attendLabel: attendLabel, ATIENDE: ATIENDE,
    hoursOf: hoursOf, openAt: openAt, hoursLabel: hoursLabel, fmtTime: fmtTime,
    normalize: normalize, publicRows: publicRows, favorites: favorites, slugify: slugify,
    fromDb: fromDb, fromDatos: fromDatos, normalizeContact: normalizeContact, contactHref: contactHref, CONTACT_KINDS: CONTACT_KINDS, mediaUrl: mediaUrl, lastError: function () { return lastError; }, fromCache: function () { return fromCache; },
    _publicCache: { save: savePublic, read: cachedPublic, load: loadPublic, KEY: PUB_KEY } // pruebas
  };
})();
