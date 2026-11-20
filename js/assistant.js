/* Ayudante contextual con la mascota Nubi. Lógica 100 % local: reglas, preguntas frecuentes y la
   misma búsqueda tolerante de la app. No usa servicios externos ni inteligencia artificial.
   Cada acción llama a una función real de Cerca.app; no ofrece nada que no exista. */
(function () {
  'use strict';
  var A = Cerca.app, C = window.CERCA_CONFIG, PLACE = C.municipioNombre;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var norm = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var narrow = function () { return window.matchMedia('(max-width: 900px)').matches; };
  var ICON_SAVE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';
  var store = function (k, v) { try { if (v === undefined) { return localStorage.getItem(k); } localStorage.setItem(k, v); } catch (e) { return null; } };

  var btn = $('#helper-btn'), panel = $('#assist'), log = $('#assist-log'), quick = $('#assist-quick'), form = $('#assist-form'), input = $('#assist-q'), bubble = $('#assist-bubble');

  /* ---------- Mascota Nubi (Dúo, js/brand.js): barra y cabecera del panel muestran el mismo estado ----------
     Los ánimos del asistente se traducen a los 7 estados dibujados de la marca. */
  var STATE = { neutral: 'feliz', happy: 'feliz', help: 'feliz', welcome: 'feliz', discover: 'feliz', celebrate: 'celebrando',
    search: 'curiosa', curious: 'curiosa', thinking: 'pensando', surprised: 'sorprendida', empty: 'triste', rest: 'descansando' };
  var figs = [$('#dock-fig'), $('#assist-fig')], current = null;
  function setMood(m) {
    var st = STATE[m] || 'feliz';
    if (st === current) { return; }
    current = st;
    figs.forEach(function (f) { f.innerHTML = Cerca.brand.mascot(st); f.dataset.state = st; var s = f.querySelector('svg'); s.setAttribute('aria-hidden', 'true'); });
  }
  setMood('neutral');
  var moodTimer = null;
  function rest() { return panel.hidden ? 'neutral' : 'help'; }
  function mood(m, ms) { setMood(m); clearTimeout(moodTimer); moodTimer = setTimeout(function () { setMood(rest()); }, ms || 1800); }
  function poke() { var f = figs[0]; f.classList.remove('is-poked'); void f.getBoundingClientRect(); f.classList.add('is-poked'); }
  figs[0].addEventListener('animationend', function () { figs[0].classList.remove('is-poked'); });

  /* ---------- Mensajes y acciones ---------- */
  var acts = {}, actN = 0, lastCtx = null;
  function act(label, fn, opts) { var id = 'a' + (++actN); acts[id] = fn; return { id: id, label: label, echo: !(opts && opts.silent) }; }
  function actBtn(a, cls) { return '<button type="button" class="chip chip--sm' + (cls ? ' ' + cls : '') + '" data-act="' + a.id + '"' + (a.echo ? ' data-echo' : '') + '>' + esc(a.label) + '</button>'; }
  function trim() { while (log.children.length > 40) { log.removeChild(log.firstChild); } }
  function bot(html, o) {
    o = o || {};
    var d = document.createElement('div'); d.className = 'msg msg--bot';
    d.innerHTML = '<p>' + html + '</p>' + (o.html || '') + (o.acts && o.acts.length ? '<div class="msg-acts">' + o.acts.map(function (a) { return actBtn(a); }).join('') + '</div>' : '');
    log.appendChild(d); trim(); log.scrollTop = log.scrollHeight;
  }
  function me(text) { var d = document.createElement('div'); d.className = 'msg msg--me'; d.textContent = text; log.appendChild(d); trim(); }
  function setQuick(list) { quick.innerHTML = list.map(function (a) { return actBtn(a); }).join(''); }
  function nav(fn) { return function () { fn(); if (narrow()) { close(false); } }; } // en el celular, cerrar para ver el resultado
  function results(list) {
    return '<ul class="msg-results">' + list.map(function (b) {
      return '<li><span class="r-name">' + esc(b.name) + '</span><span class="r-meta">' + esc(b.category) + ', ' + (A.isOpen(b) ? 'abierto ahora' : 'cerrado ahora') + '</span>' +
        '<span class="r-acts">' + actBtn(act('Ver en el mapa', nav(function () { A.showMap(b.id); }), { silent: true })) +
        '<a class="chip chip--sm" href="#/negocio/' + b.id + '">Perfil</a>' +
        '<button type="button" class="save save--sm" data-save="' + b.id + '" aria-pressed="' + A.isSaved(b.id) + '" aria-label="Guardar ' + esc(b.name) + '">' + ICON_SAVE + '</button></span></li>';
    }).join('') + '</ul>';
  }
  function count(c) { return A.data.filter(function (b) { return b.category === c; }).length; }

  /* ---------- Temas ---------- */
  var T = {
    find: function () { bot('Escribe abajo lo que necesitas, por ejemplo «pan», «copias» o «arreglar celular». Busco entre los negocios de prueba de ' + esc(PLACE) + '.'); input.focus(); },
    cats: function () { bot('Estas son las categorías. Toca una para ver sus negocios.', { acts: A.categories.map(function (c) { return act(c + ' (' + count(c) + ')', nav(function () { A.setCategory(c); })); }) }); },
    open: function () {
      var l = A.openNowList();
      if (!l.length) { mood('empty'); bot('Según su horario, ahora mismo ningún negocio de prueba está abierto.', { acts: [act('Ver todos', nav(function () { A.setCategory('Todos'); }))] }); return; }
      mood('discover');
      bot('Según su horario y la hora de Colombia, ' + (l.length === 1 ? 'hay 1 negocio abierto' : 'hay ' + l.length + ' negocios abiertos') + '.', { html: results(l.slice(0, 3)), acts: [act('Ver todos los abiertos', nav(A.openNow))] });
    },
    map: function () {
      bot('Cada marcador es un negocio y su color indica la categoría. Los marcadores tenues están cerrados ahora. Toca uno para ver su tarjeta, pellizca o usa + y − para acercar, y toca «' + esc(PLACE) + '» para volver al centro.',
        { acts: [act('Abrir el mapa', nav(function () { A.showMap(null); })), act('Volver al centro', nav(A.home))] });
    },
    owner: function () { bot('El registro de negocios todavía no está abierto. Ya puedes ver qué datos vas a necesitar y probar cómo se vería tu tarjeta.', { acts: [act('Ir a Tu negocio', nav(function () { A.go('#/mi-negocio'); })), act('¿Cuánto cuesta?', ownerCost)] }); },
    faq: function () { bot('Preguntas frecuentes:', { acts: FAQ.map(function (f) { return act(f.q, function () { answer(f); }); }) }); },
    saved: function () { var n = A.saved().length; bot(n ? 'Tienes ' + n + (n === 1 ? ' negocio guardado' : ' negocios guardados') + '.' : 'Todavía no tienes negocios guardados.', { acts: [act('Ver guardados', nav(function () { A.go('#/guardados'); }))] }); }
  };
  function ownerCost() { bot('Esta versión de prueba no tiene pagos ni suscripciones. Las condiciones del registro se definirán antes de abrirlo.'); }
  function themeAct() { A.toggleTheme(); bot('Listo, ahora usas el tema ' + (A.theme() === 'dark' ? 'oscuro' : 'claro') + '.'); }

  var FAQ = [
    { q: '¿Los negocios son reales?', k: /\breal|ficti|de verdad|de prueba|demo/, a: 'No. Esta es una versión de prueba: todos los negocios, teléfonos y direcciones son ficticios.' },
    { q: '¿Necesito una cuenta?', k: /cuenta|iniciar sesion|login|contrasena|registrarme/, a: 'No. Puedes explorar y guardar negocios sin registrarte. Las cuentas todavía no existen.' },
    { q: '¿Cómo guardo un negocio?', k: /guard|favorit/, a: 'Toca el marcador con forma de cinta en una tarjeta o en el perfil del negocio. Tus guardados quedan solo en este dispositivo.', acts: function () { return [act('Ver guardados', nav(function () { A.go('#/guardados'); }))]; } },
    { q: '¿Qué significa «Abierto ahora»?', k: /significa abierto|abierto ahora que|como sabe.*abierto|horario/, a: 'Comparamos la hora actual de Colombia con el horario publicado por cada negocio. Si un negocio cambia su horario, puede no coincidir.' },
    { q: '¿Qué es «Reubicado»?', k: /reubicad|etiqueta|que es nuevo/, a: '«Reubicado» indica que el negocio cambió de lugar hace poco; «Nuevo», que acaba de llegar a la plataforma.' },
    { q: '¿Cómo la instalo en el celular?', k: /instal|pantalla (de )?inicio|pantalla principal|descarg|\bapp\b|aplicacion/, a: 'En Chrome para Android toca ⋮ y elige «Agregar a la pantalla principal» o «Instalar app». Se abrirá como una app, sin la barra del navegador.',
      acts: function () { return A.canInstall() ? [act('Instalar ahora', function () { A.go('#/ajustes'); if (narrow()) { close(false); } })] : []; } },
    { q: '¿Cómo activo el modo oscuro?', k: /oscur|modo claro|tema|noche/, a: 'Con el botón de luna en la barra superior o desde Ajustes.', acts: function () { return [act('Cambiar tema ahora', themeAct)]; } },
    { q: '¿En qué municipios funciona?', k: /municipio|ciudad|pueblo|donde funciona|otros lugares|cali|tulua|zarzal/, a: 'Por ahora solo en ' + esc(PLACE) + ', Valle del Cauca. La plataforma está pensada para sumar más municipios.' }
  ];
  function faqBy(word) { return FAQ.filter(function (f) { return f.k.test(word); })[0]; }
  function answer(f) { mood('happy'); bot(f.a, { acts: f.acts ? f.acts() : [] }); }

  function mainActs() {
    return [act('Buscar algo', T.find), act('Categorías', T.cats), act('Abierto ahora', T.open), act('Cómo usar el mapa', T.map),
      act('Registrar mi negocio', T.owner), act('Preguntas frecuentes', T.faq)];
  }

  /* ---------- Texto libre: reglas locales y luego búsqueda ---------- */
  var OWNER = /(registr|inscrib|agreg|anunci|publica|subir)\w*\s+(a\s+)?(mi|un|el)?\s*(negocio|local|tienda|comercio|empresa|emprendimiento)|mi negocio|soy (el )?(dueno|propietario|comerciante)/;
  function handle(raw) {
    var n = norm(raw);
    if (!n) { return; }
    if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que mas)\b/.test(n) && n.split(' ').length <= 3) { mood('welcome', 2000); bot('Hola. Dime qué buscas o elige una opción.', { acts: mainActs() }); return; }
    if (/^(gracias|muchas gracias|listo|ok|vale)\b/.test(n)) { mood('happy'); bot('Con gusto. Aquí sigo si necesitas algo más.'); return; }
    if (/que (puedes|sabes) hacer|^ayuda$|como funciona|como se usa/.test(n)) { bot('Puedo buscar negocios, mostrarte categorías, decirte qué está abierto, explicarte el mapa y responder dudas.', { acts: mainActs() }); return; }
    if (OWNER.test(n)) { T.owner(); return; }
    if (/cuanto cuesta|precio de registr|cobran|es gratis/.test(n)) { ownerCost(); return; }
    var f = FAQ.filter(function (x) { return x.k.test(n); })[0];
    if (f) { answer(f); return; }
    if (/mapa|marcador|ubicacion|zoom|como llego/.test(n)) { T.map(); return; }
    if (/categor/.test(n)) { T.cats(); return; }
    if (/^(que hay |que esta |negocios )?abiert|abierto ahora|que abre/.test(n)) { T.open(); return; }
    var cat = A.categories.filter(function (c) { return norm(c) === n; })[0];
    if (cat) { mood('discover'); bot('Te muestro la categoría ' + esc(cat) + '.', { acts: [act('Ver ' + cat + ' (' + count(cat) + ')', nav(function () { A.setCategory(cat); }))] }); return; }
    find(raw);
  }
  function find(text) {
    var r = Cerca.search.rank(A.data, text), l = r.items; // la misma búsqueda que el buscador principal
    if (!l.length) {
      mood('empty', 2600);
      bot('No encontré «' + esc(text) + '» entre los negocios de prueba. Prueba con otra palabra o mira las categorías.', { acts: [act('Ver categorías', T.cats), act('Preguntas frecuentes', T.faq)] });
      return;
    }
    mood('discover');
    bot((r.approximate ? 'No encontré «' + esc(text) + '» exacto, pero esto se parece:' : (l.length === 1 ? 'Encontré 1 negocio' : 'Encontré ' + l.length + ' negocios') + ' para «' + esc(text) + '»:'),
      { html: results(l.slice(0, 3)), acts: [act(l.length > 3 ? 'Ver los ' + l.length + ' en Explorar' : 'Ver en Explorar', nav(function () { A.search(text); }))] });
  }

  /* ---------- Contexto según la vista ---------- */
  function greet(topic) {
    setQuick(mainActs());
    if (topic && T[topic]) { T[topic](); return; }
    var v = A.view(), b = A.profile(), key = v + (b ? b.id : '');
    if (key === lastCtx && log.children.length) { return; }
    lastCtx = key;
    if (v === 'profile') {
      bot('Estás viendo <strong>' + esc(b.name) + '</strong>. ¿Qué quieres hacer?', { acts: [
        act('Verlo en el mapa', nav(function () { A.showMap(b.id); })),
        act(A.isSaved(b.id) ? 'Quitar de guardados' : 'Guardarlo', function () { bot(A.toggleSave(b.id) ? 'Guardado. Lo encuentras en Guardados.' : 'Lo quité de tus guardados.'); }),
        act('Parecidos en ' + b.category, function () { var l = A.data.filter(function (x) { return x.category === b.category && x.id !== b.id; }); bot(l.length ? 'Otros negocios de ' + esc(b.category) + ':' : 'No hay otros negocios en esta categoría.', { html: l.length ? results(l.slice(0, 3)) : '' }); })
      ] });
    } else if (v === 'saved') {
      var n = A.saved().length;
      bot(n ? 'Tienes ' + n + (n === 1 ? ' negocio guardado' : ' negocios guardados') + '. Toca una tarjeta para verla en el mapa.' : 'Todavía no tienes guardados. Busca un negocio y toca su marcador para guardarlo.',
        { acts: [act('Buscar algo', T.find), act('¿Cómo guardo un negocio?', function () { answer(faqBy('guardar')); })] });
    } else if (v === 'owner') {
      bot('¿Tienes un negocio en ' + esc(PLACE) + '? Te cuento cómo va el registro.', { acts: [
        act('¿Qué necesito?', function () { bot('Nombre y categoría, ubicación, horario, un contacto, una foto y una frase corta. Puedes probar la vista previa de tu tarjeta en esta misma página.'); }),
        act('¿Cuándo abre el registro?', function () { bot('Todavía no tiene fecha. Por ahora la plataforma está en pruebas con negocios ficticios.'); }),
        act('¿Cuánto cuesta?', ownerCost)
      ] });
    } else if (v === 'settings') {
      bot('Aquí puedes cambiar el tema, revisar tus guardados o instalar la app.', { acts: [act('¿Cómo la instalo?', function () { answer(faqBy('instalar')); }), act('Cambiar tema', themeAct)] });
    } else {
      bot(store('cerca.assist.used') ? '¿Qué necesitas encontrar?' : 'Hola, soy Nubi. Te ayudo a encontrar negocios en ' + esc(PLACE) + ' y a usar la app. Elige una opción o escribe abajo.');
    }
  }

  /* ---------- Abrir y cerrar ---------- */
  function open(topic) {
    panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); hideBubble(); poke(); setMood('help');
    greet(topic); store('cerca.assist.used', '1');
    $('#assist-title').focus({ preventScroll: true });
  }
  function close(focusBtn) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); setMood('neutral'); if (focusBtn) { btn.focus(); } }
  btn.addEventListener('click', function () { if (panel.hidden) { open(); } else { close(true); } });
  $('#assist-close').addEventListener('click', function () { close(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { close(true); } });
  document.addEventListener('pointerdown', function (e) {
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) { close(false); }
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-assist-topic]'); if (t) { open(t.dataset.assistTopic); }
    var nl = e.target.closest('.nav a'); if (nl && !panel.hidden && narrow()) { close(false); }
  });
  function onAct(e) {
    var b = e.target.closest('[data-act]');
    if (b && acts[b.dataset.act]) { if (b.hasAttribute('data-echo')) { me(b.textContent); } acts[b.dataset.act](); log.scrollTop = log.scrollHeight; return; }
    if (e.target.closest('a[href^="#/"]') && narrow()) { close(false); }
  }
  log.addEventListener('click', onAct); quick.addEventListener('click', onAct);
  form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value.trim(); if (!v) { return; } me(v); input.value = ''; mood('thinking', 900); handle(v); });

  /* ---------- Bienvenida: solo la primera visita, sobre la barra, sin tapar el contenido ---------- */
  var bubbleTimer = null;
  function hideBubble() { bubble.hidden = true; clearTimeout(bubbleTimer); }
  bubble.addEventListener('click', function () { open(); });
  if (!store('cerca.assist.welcomed')) {
    store('cerca.assist.welcomed', '1');
    setTimeout(function () {
      if (!panel.hidden) { return; }
      mood('welcome', 2200);
      bubble.textContent = 'Hola, soy Nubi. Tócame si necesitas ayuda para buscar o usar el mapa.';
      bubble.hidden = false; bubbleTimer = setTimeout(hideBubble, 6000);
    }, 1200);
  }

  Cerca.assistant = {
    mood: function (m) { if (panel.hidden || m !== 'search') { mood(m, m === 'empty' ? 2600 : 1800); } },
    onRoute: function () { if (!panel.hidden) { greet(); } },
    open: open
  };
})();
