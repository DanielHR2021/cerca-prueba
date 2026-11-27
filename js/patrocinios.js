/* Patrocinios de negocios: capacidad preparada y DESACTIVADA (2026-11-27).
   Reglas (ver docs/evolucion/patrocinios.md):
   - Solo campañas reales, aprobadas por la administración, de negocios publicados (tabla public.campanas, migración 0008).
   - Siempre se rotulan «Patrocinado» y explican por qué se ven; nunca cambian el orden ni ocultan resultados orgánicos.
   - Sin campañas vigentes no se dibuja nada (ningún espacio vacío). Sin redes publicitarias, sin rastreo, sin cookies:
     la elección depende solo de la categoría que se está viendo, nunca de la actividad de la persona.
   - Con CERCA_CONFIG.patrocinios.activo = false (valor actual) no se hace ninguna consulta. */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var C = window.CERCA_CONFIG || {}, cfg = C.patrocinios || {}, campanas = [], cargado = false;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  function vigente(c, ahora) {
    var ini = Date.parse(c.inicia), fin = c.termina ? Date.parse(c.termina) : Infinity;
    return c && c.negocio_id && c.titulo && isFinite(ini) && ini <= ahora && fin > ahora;
  }
  /* Lectura pública de la vista campanas_activas (solo vigentes de negocios publicados; la regla está en la BD). */
  function cargar() {
    if (!cfg.activo || !C.supabase || !window.fetch) { return Promise.resolve([]); }
    var url = C.supabase.url + '/rest/v1/campanas_activas?select=id,negocio_id,titulo,texto,categoria,inicia,termina&municipio_id=eq.' + encodeURIComponent(C.municipio);
    return fetch(url, { headers: { apikey: C.supabase.publishableKey } }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (l) { campanas = Array.isArray(l) ? l : []; cargado = true; document.dispatchEvent(new Event('nubi:patrocinios')); return campanas; })
      .catch(function () { campanas = []; return []; }); // si falla, simplemente no hay patrocinio: nunca bloquea la app
  }
  /* Elige como máximo una campaña para la vista actual: de la categoría vista o general; rota por día, no por persona. */
  function elegir(cat) {
    var ahora = Date.now(), negocios = (Cerca.store && Cerca.store.list()) || [];
    var l = campanas.filter(function (c) {
      return vigente(c, ahora) && (!c.categoria || cat === 'Todos' || c.categoria === cat) && negocios.some(function (b) { return b.uid === c.negocio_id; });
    });
    if (!l.length) { return null; }
    var c = l[Math.floor(ahora / 86400000) % l.length];
    return { c: c, b: negocios.filter(function (x) { return x.uid === c.negocio_id; })[0] };
  }
  function tarjeta(state) {
    var e = cfg.activo && cargado && elegir(state && state.cat || 'Todos'); if (!e) { return ''; }
    return '<li class="promo" aria-label="Contenido patrocinado"><div class="promo-top"><span class="promo-lbl">Patrocinado</span>' +
      '<details class="promo-why"><summary>¿Por qué veo esto?</summary><p>Este negocio paga para aparecer aquí. No cambia el orden de los resultados ni usa tu actividad: se muestra a todas las personas que ven ' +
      (e.c.categoria ? 'la categoría ' + esc(e.c.categoria) : 'Explorar') + '.</p></details></div>' +
      '<a class="promo-main" href="#/negocio/' + esc(e.b.slug) + '"><span class="promo-name">' + esc(e.b.name) + '</span><span class="promo-title">' + esc(e.c.titulo) + '</span>' +
      (e.c.texto ? '<span class="promo-text">' + esc(e.c.texto) + '</span>' : '') + '</a></li>';
  }
  Cerca.patrocinios = { cargar: cargar, tarjeta: tarjeta, activo: function () { return !!cfg.activo; }, _set: function (l, activo) { campanas = l; cargado = true; cfg.activo = activo; } };
  cargar();
})();
