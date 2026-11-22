/* Panel de moderación (Etapa 1, T7) y copia de seguridad (T9). Ruta #/admin.
   - Solo para cuentas en public.administradores. La base de datos lo exige (funciones security definer):
     esta pantalla solo ordena el trabajo y muestra los errores del servidor.
   - D9: nadie aprueba lo suyo; el servidor lo rechaza aunque la persona sea administradora.
   - T9: «Descargar copia» guarda en un archivo JSON todo lo que la administración puede leer (sin correos de usuarios).
     Las imágenes no van en el archivo: quedan listadas por ruta (ver docs/operacion/copias-de-seguridad.md). */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var C = window.CERCA_CONFIG || {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var ACC = { crear_negocio: 'Negocio creado', nueva_revision: 'Cambios iniciados', enviar_revision: 'Enviado a revisión', retirar_revision: 'Envío retirado',
    aprobar_revision: 'Aprobado', solicitar_correccion: 'Corrección pedida', rechazar_revision: 'Rechazado', suspender_negocio: 'Suspendido', reactivar_negocio: 'Reactivado',
    retirar_negocio: 'Retirado por su propietario', eliminar_borrador: 'Borrador eliminado', eliminar_negocio: 'Eliminado definitivamente' };
  var st = { admin: null, pend: [], pub: [], reg: [], nombres: {}, zonas: {}, abierta: null, msg: '', msgErr: false };
  function client() { return Cerca.auth.ready(); }
  function root() { return $('#mod'); }
  function fecha(t) { try { return new Date(t).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return t; } }
  function say(m, err) { st.msg = m || ''; st.msgErr = !!err; pintar(); }

  function esAdmin() {
    return client().then(function (c) { return c.rpc('es_admin'); }).then(function (r) { st.admin = !r.error && r.data === true; return st.admin; });
  }
  function cargar() {
    return client().then(function (c) {
      return Promise.all([
        c.from('revisiones').select('id, negocio_id, datos, enviada_en, creada_por, negocios(nombre, estado, publicado_en)').eq('estado', 'pendiente').order('enviada_en'),
        c.from('negocios').select('id, nombre, estado, slug, publicado_en').order('nombre'),
        c.from('registro_acciones').select('accion, negocio_id, en, detalle').order('en', { ascending: false }).limit(25),
        c.from('zonas').select('id, nombre')
      ]).then(function (r) {
        var err = r.filter(function (x) { return x.error; })[0]; if (err) { throw err.error; }
        st.pend = r[0].data; st.nombres = {}; r[1].data.forEach(function (n) { st.nombres[n.id] = n.nombre; });
        st.pub = r[1].data.filter(function (n) { return n.estado === 'publicado' || n.estado === 'suspendido'; });
        st.ret = r[1].data.filter(function (n) { return n.estado === 'retirado'; });
        st.reg = r[2].data; st.zonas = {}; r[3].data.forEach(function (z) { st.zonas[z.id] = z.nombre; });
      });
    }).then(pintar, function (e) { say('No se pudo cargar el panel: ' + (e.message || e), true); });
  }
  function rpc(nombre, args, ok) {
    say('Procesando…');
    return client().then(function (c) { return c.rpc(nombre, args); }).then(function (r) {
      if (r.error) { throw r.error; }
      say(ok); return cargar();
    }).catch(function (e) { say(/administras/.test(e.message || '') ? 'No puedes decidir sobre un negocio que tú mismo administras (regla D9). Debe hacerlo otra persona administradora.' : (e.message || 'Error'), true); });
  }
  function motivo(id) { var t = $('#mot-' + id); return t ? t.value.trim() : ''; }

  function tarjetaPendiente(r) {
    var d = r.datos || {}, nuevo = !r.negocios || !r.negocios.publicado_en, abierta = st.abierta === r.id;
    var b = abierta ? Cerca.store.normalize(Cerca.store.fromDatos(d, { zonaNombre: d.ubicacion && st.zonas[d.ubicacion.zona_id] }), 'mod') : null;
    return '<li class="reg-item mod-item"><div><strong>' + esc(d.nombre || 'Sin nombre') + '</strong> <span class="reg-badge">' + (nuevo ? 'Negocio nuevo' : 'Cambios a ficha publicada') + '</span>' +
      '<p class="ed-hint">Enviado ' + esc(fecha(r.enviada_en)) + ' · ' + esc(d.categoria || 'sin categoría') + ' · ' + (d.ubicacion && d.ubicacion.modo === 'zona' ? 'Atiende en zona: ' + esc(st.zonas[d.ubicacion.zona_id] || '') : 'Con local') + '</p></div>' +
      '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-mod="ver" data-id="' + r.id + '">' + (abierta ? 'Ocultar ficha' : 'Ver ficha propuesta') + '</button></div>' +
      (abierta ? '<div class="reg-preview">' + Cerca.profiles.render(b, Cerca.app.profileHelpers(true)) + '</div>' : '') +
      '<label class="mod-mot" for="mot-' + r.id + '">Motivo (obligatorio para pedir corrección o rechazar)</label><textarea id="mot-' + r.id + '" maxlength="500" placeholder="Ej.: Falta la foto de la fachada; la dirección no coincide"></textarea>' +
      '<div class="auth-acts"><button type="button" class="btn" data-mod="aprobar" data-id="' + r.id + '">Aprobar y publicar</button>' +
      '<button type="button" class="btn btn--ghost" data-mod="corregir" data-id="' + r.id + '">Pedir corrección</button>' +
      '<button type="button" class="btn btn--ghost" data-mod="rechazar" data-id="' + r.id + '">Rechazar</button></div></li>';
  }
  function pintar() {
    var r = root(); if (!r) { return; }
    var a = Cerca.auth && Cerca.auth.state();
    if (!a || a.status !== 'signed_in') { r.innerHTML = '<p>Inicia sesión en <a href="#/mi-negocio">Negocio</a> con una cuenta de administración.</p>'; return; }
    if (st.admin === null) { r.innerHTML = '<p class="ed-hint" role="status">Comprobando permisos…</p>'; return; }
    if (!st.admin) { r.innerHTML = '<p>Tu cuenta no es administradora. Este panel es solo para revisar negocios.</p>'; return; }
    r.innerHTML = (st.msg ? '<p class="auth-msg' + (st.msgErr ? ' is-error' : '') + '" role="alert">' + esc(st.msg) + '</p>' : '') +
      '<section class="panel-card"><h2>Pendientes de revisión (' + st.pend.length + ')</h2>' +
      (st.pend.length ? '<ul class="reg-list">' + st.pend.map(tarjetaPendiente).join('') + '</ul>' : '<p>No hay nada por revisar.</p>') + '</section>' +
      '<section class="panel-card"><h2>Publicados (' + st.pub.length + ')</h2>' + (st.pub.length ? '<ul class="reg-list">' + st.pub.map(function (n) {
        return '<li class="reg-item"><div><strong>' + esc(n.nombre) + '</strong> <span class="reg-badge reg-badge--' + n.estado + '">' + (n.estado === 'suspendido' ? 'Suspendido' : 'Publicado') + '</span>' +
          (n.slug ? ' <a class="reg-link" href="#/negocio/' + esc(n.slug) + '">Ficha</a>' : '') + '</div>' +
          (n.estado === 'publicado' ? '<label class="mod-mot" for="mot-' + n.id + '">Motivo de suspensión</label><textarea id="mot-' + n.id + '" maxlength="500"></textarea><div class="auth-acts"><button type="button" class="btn btn--ghost" data-mod="suspender" data-id="' + n.id + '">Suspender</button></div>'
            : '<div class="auth-acts"><button type="button" class="btn" data-mod="reactivar" data-id="' + n.id + '">Reactivar</button></div>') + '</li>';
      }).join('') + '</ul>' : '<p>Aún no hay negocios publicados.</p>') + '<p class="ed-hint">Los cambios aprobados aparecen en el mapa al recargar la app.</p></section>' +
      ((st.ret || []).length ? '<section class="panel-card"><h2>Retirados por su propietario (' + st.ret.length + ')</h2><p class="ed-hint">No se muestran al público. Elimínalos definitivamente solo si el comerciante lo pidió.</p><ul class="reg-list">' + st.ret.map(function (n) {
        return '<li class="reg-item"><div><strong>' + esc(n.nombre || 'Sin nombre') + '</strong> <span class="reg-badge reg-badge--retirado">Retirado</span></div>' +
          '<label class="mod-mot" for="mot-' + n.id + '">Motivo de la eliminación</label><textarea id="mot-' + n.id + '" maxlength="500" placeholder="Ej.: El comerciante pidió borrar sus datos"></textarea>' +
          '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-mod="eliminar" data-id="' + n.id + '">Eliminar definitivamente</button></div></li>';
      }).join('') + '</ul></section>' : '') +
      '<section class="panel-card"><h2>Últimas acciones</h2>' + (st.reg.length ? '<ul class="mod-log">' + st.reg.map(function (x) {
        return '<li><span>' + esc(fecha(x.en)) + '</span> ' + esc(ACC[x.accion] || x.accion) + ' · ' + esc(st.nombres[x.negocio_id] || (x.detalle && x.detalle.nombre) || '—') + (x.detalle && x.detalle.motivo ? ' · «' + esc(x.detalle.motivo) + '»' : '') + '</li>';
      }).join('') + '</ul>' : '<p>Sin acciones todavía.</p>') + '</section>' +
      '<section class="panel-card"><h2>Copia de seguridad</h2><p>Descarga en un archivo todos los datos del servidor de pruebas que la administración puede leer (negocios, revisiones, horarios, contactos, ofertas, rutas de imágenes y registro). No incluye correos de usuarios ni las imágenes.</p>' +
      '<div class="auth-acts"><button type="button" class="btn" data-mod="copia">Descargar copia (JSON)</button></div><p class="ed-hint">Guárdala en una carpeta privada. Procedimiento completo: docs/operacion/copias-de-seguridad.md.</p></section>';
  }

  /* T9: copia JSON con todo lo legible por la administración. */
  var TABLAS = ['municipios', 'zonas', 'negocios', 'miembros_negocio', 'horarios', 'horarios_excepciones', 'contactos', 'ofertas', 'medios', 'revisiones', 'registro_acciones', 'administradores'];
  function copia() {
    say('Preparando la copia…');
    return client().then(function (c) {
      return Promise.all(TABLAS.map(function (t) { return c.from(t).select('*').then(function (r) { if (r.error) { throw new Error(t + ': ' + r.error.message); } return [t, r.data]; }); }));
    }).then(function (pares) {
      var datos = { _nubi: { tipo: 'copia-de-seguridad', version: 1, exportado_en: new Date().toISOString(), proyecto: C.supabase && C.supabase.url, nota: 'Sin correos de usuarios ni archivos de imagen (las rutas están en «medios»).' } };
      pares.forEach(function (p) { datos[p[0]] = p[1]; });
      var blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'nubi-copia-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      say('Copia descargada (' + pares.map(function (p) { return p[0] + ': ' + p[1].length; }).join(', ') + ').');
      return datos;
    }).catch(function (e) { say('No se pudo hacer la copia: ' + e.message, true); });
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-mod]'); if (!b || !root() || !root().contains(b)) { return; }
    var id = b.dataset.id, a = b.dataset.mod;
    if (a === 'ver') { st.abierta = st.abierta === id ? null : id; pintar(); }
    if (a === 'aprobar') { rpc('aprobar_revision', { p_revision: id }, 'Aprobado y publicado.'); }
    if (a === 'corregir') { if (motivo(id).length < 5) { say('Escribe qué debe corregir (mínimo 5 caracteres).', true); return; } rpc('solicitar_correccion', { p_revision: id, p_motivo: motivo(id) }, 'Se pidió la corrección.'); }
    if (a === 'rechazar') { if (motivo(id).length < 5) { say('Escribe el motivo del rechazo (mínimo 5 caracteres).', true); return; } rpc('rechazar_revision', { p_revision: id, p_motivo: motivo(id) }, 'Rechazado.'); }
    if (a === 'suspender') { if (motivo(id).length < 5) { say('Escribe el motivo de la suspensión.', true); return; } rpc('suspender_negocio', { p_negocio: id, p_motivo: motivo(id) }, 'Negocio suspendido: ya no se muestra al público.'); }
    if (a === 'eliminar') {
      if (motivo(id).length < 5) { say('Escribe el motivo de la eliminación (mínimo 5 caracteres).', true); return; }
      if (!confirm('¿Eliminar definitivamente este negocio y todos sus datos? No se puede deshacer. Descarga una copia antes si la necesitas.')) { return; }
      rpc('eliminar_negocio', { p_negocio: id, p_motivo: motivo(id) }, 'Negocio eliminado definitivamente (queda constancia en el registro).');
    }
    if (a === 'reactivar') { rpc('reactivar_negocio', { p_negocio: id }, 'Negocio reactivado.'); }
    if (a === 'copia') { copia(); }
  });

  function abrir() {
    if (location.hash !== '#/admin') { return; }
    var a = Cerca.auth && Cerca.auth.state();
    if (!a || a.status !== 'signed_in') { pintar(); if (Cerca.auth) { Cerca.auth.ready().catch(function () {}); } return; }
    st.admin = null; st.msg = ''; st.abierta = null; pintar(); // cada visita empieza limpia
    esAdmin().then(function (ok) { if (ok) { return cargar(); } pintar(); }).catch(function () { st.admin = false; pintar(); });
  }
  /* Enlace en Ajustes solo para administración */
  function enlaceAjustes() {
    var host = $('#view-settings main') || $('#view-settings'); if (!host) { return; }
    var l = $('#mod-link');
    var a = Cerca.auth && Cerca.auth.state(), show = a && a.status === 'signed_in' && st.admin;
    if (show && !l) { host.insertAdjacentHTML('beforeend', '<p id="mod-link" class="panel-card"><a class="btn" href="#/admin">Panel de moderación</a></p>'); }
    if (!show && l) { l.remove(); }
  }
  function init() {
    window.addEventListener('hashchange', abrir);
    if (Cerca.auth) { Cerca.auth.onChange(function (s) { if (s.status === 'signed_in' && st.admin === null) { esAdmin().then(enlaceAjustes); } else { if (s.status !== 'signed_in') { st.admin = null; } enlaceAjustes(); } if (location.hash === '#/admin') { abrir(); } }); }
    abrir();
    // Si la sesión ya estaba iniciada antes de que este módulo arrancara, comprobar el permiso ahora.
    var a0 = Cerca.auth && Cerca.auth.state();
    if (a0 && a0.status === 'signed_in' && st.admin === null && location.hash !== '#/admin') { esAdmin().then(enlaceAjustes, function () {}); }
  }
  if (Cerca.app) { init(); } else { document.addEventListener('nubi:app-lista', init, { once: true }); }
  Cerca.moderacion = { estado: function () { return st; }, cargar: cargar, copia: copia, abrir: abrir };
})();
