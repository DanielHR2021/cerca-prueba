/* Registro guiado de negocios (Etapa 1, T6 = Entrega B). Visible en «Negocio» con la sesión iniciada.
   - Lo que escribe el comerciante se guarda como REVISIÓN en Supabase (revisiones.datos), nunca directo en lo público.
   - Seis pasos: básico, ubicación, horarios, contacto, oferta y fotos, vista previa y envío a revisión.
   - Nada se publica sin aprobación de un administrador ajeno (D2, D9). Las reglas están en la base de datos;
     esta interfaz solo guía, valida antes de enviar y explica los errores.
   - Sin local (D10): el comerciante elige una zona general; no se pide ni se guarda su domicilio. */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var C = window.CERCA_CONFIG || {}, S = function () { return Cerca.store; };
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var STEPS = ['Lo básico', 'Ubicación', 'Horarios', 'Contacto', 'Oferta y fotos', 'Vista previa'];
  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var PAGOS = ['Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Tarjeta'];
  var ESTADO = { borrador: 'Borrador', pendiente: 'En revisión', publicado: 'Publicado', requiere_correccion: 'Requiere corrección', rechazado: 'Rechazado', suspendido: 'Suspendido', retirado: 'Retirado',
    aprobada: 'Aprobada', rechazada: 'Rechazada', retirada: 'Retirada' };
  var MAX_OFERTAS = 12, MAX_GALERIA = 4;

  var st = { view: 'lista', negocios: [], rev: null, negocio: null, step: 0, datos: {}, zonas: [], saving: null, msg: '', errors: {} };
  var saveTimer = null, miniMap = null, miniMarker = null;
  function client() { return Cerca.auth.ready(); }
  function uid() { var u = Cerca.auth.user(); return u && u.id; }
  function root() { return $('#reg'); }
  function say(m, isErr) { st.msg = m || ''; st.msgErr = !!isErr; var n = $('#reg-msg'); if (n) { n.textContent = st.msg; n.className = 'auth-msg' + (isErr ? ' is-error' : ''); n.hidden = !st.msg; } }
  function errText(e) {
    var m = (e && (e.message || e.error_description)) || '';
    if (/Límite|Ya hay una revisión|Datos incompletos|No autorizado|Municipio|Nombre/.test(m)) { return m; }
    if (navigator.onLine === false) { return 'Sin conexión. Tus cambios quedan en este dispositivo y se guardarán al volver la conexión.'; }
    return 'No se pudo completar la acción. Inténtalo de nuevo.' + (m ? ' (' + m + ')' : '');
  }

  /* ---------- Datos ---------- */
  function cargarLista() {
    return client().then(function (c) {
      return c.from('miembros_negocio').select('negocio_id, rol, negocios(id, nombre, estado, slug, publicado_en)').eq('user_id', uid()).then(function (r) {
        if (r.error) { throw r.error; }
        var neg = (r.data || []).map(function (m) { return Object.assign({ rol: m.rol }, m.negocios); }).filter(function (n) { return n && n.id; });
        if (!neg.length) { return []; }
        return c.from('revisiones').select('id, negocio_id, estado, datos, motivo, actualizada_en').in('negocio_id', neg.map(function (n) { return n.id; })).order('creada_en', { ascending: false })
          .then(function (rv) {
            if (rv.error) { throw rv.error; }
            neg.forEach(function (n) {
              var mine = (rv.data || []).filter(function (x) { return x.negocio_id === n.id; });
              n.abierta = mine.filter(function (x) { return /^(borrador|pendiente|requiere_correccion)$/.test(x.estado); })[0] || null;
              n.ultima = mine[0] || null;
              n.titulo = (n.abierta && n.abierta.datos && n.abierta.datos.nombre) || n.nombre || 'Negocio sin nombre';
            });
            return neg;
          });
      });
    });
  }
  function cargarZonas() {
    return client().then(function (c) { return c.from('zonas').select('id, nombre, tipo').eq('municipio_id', C.municipio).eq('activa', true).order('nombre'); })
      .then(function (r) { st.zonas = (r && r.data) || []; });
  }
  function guardar(inmediato) {
    clearTimeout(saveTimer);
    var rev = st.rev; if (!rev || !/^(borrador|requiere_correccion)$/.test(rev.estado)) { return Promise.resolve(); }
    try { localStorage.setItem('nubi.registro.' + rev.id, JSON.stringify(st.datos)); } catch (e) { /* respaldo local opcional */ }
    var run = function () {
      estadoGuardado('Guardando…');
      return client().then(function (c) { return c.from('revisiones').update({ datos: st.datos }).eq('id', rev.id).select('id'); }).then(function (r) {
        if (r.error || !r.data || !r.data.length) { throw r.error || new Error('No se pudo guardar'); }
        estadoGuardado('Guardado ' + new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }));
      }).catch(function (e) { estadoGuardado('Sin guardar: ' + errText(e)); });
    };
    if (inmediato) { return run(); }
    saveTimer = setTimeout(run, 900);
    return Promise.resolve();
  }
  function estadoGuardado(t) { var n = $('#reg-saved'); if (n) { n.textContent = t; } }

  /* ---------- Validación (igual que validar_datos en la base de datos, con mensajes para personas) ---------- */
  function validar(d) {
    var e = {};
    if (!d.nombre || d.nombre.trim().length < 2 || d.nombre.length > 60) { e.nombre = 'Escribe el nombre comercial (2 a 60 caracteres).'; }
    if (!d.tipo) { e.tipo = 'Elige el tipo de negocio.'; }
    var u = d.ubicacion || {};
    if (u.modo === 'local') { if (!isFinite(u.lat) || !isFinite(u.lng)) { e.ubicacion = 'Marca en el mapa dónde atiendes.'; } }
    else if (u.modo === 'zona') { if (!u.zona_id) { e.ubicacion = 'Elige la zona donde atiendes.'; } }
    else { e.ubicacion = 'Indica si tienes un local o si atiendes en una zona.'; }
    var h = d.horario || {};
    if (h.modo === 'fijo' && !(h.semana || []).length) { e.horario = 'Marca al menos un día con su horario, o elige «con cita» o «variable».'; }
    (h.semana || []).forEach(function (s) { if (!s.abre || !s.cierra || s.abre === s.cierra) { e.horario = 'Revisa las horas: apertura y cierre no pueden ser iguales.'; } });
    (d.contactos || []).forEach(function (c) { var n = S().normalizeContact(c.tipo, c.valor); if (n.error) { e['c_' + c.tipo] = n.error; } });
    return e;
  }
  function pasoDeError(k) { return /^(nombre|tipo)$/.test(k) ? 0 : k === 'ubicacion' ? 1 : k === 'horario' ? 2 : /^c_/.test(k) ? 3 : 4; }

  /* ---------- Imágenes: se comprimen en el teléfono a WebP antes de subir (D7: 1 GB gratis) ---------- */
  function comprimir(file, max, calidad) {
    return new Promise(function (res, rej) {
      if (!/^image\//.test(file.type)) { rej(new Error('Ese archivo no es una imagen.')); return; }
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        var intento = function (q) {
          cv.toBlob(function (b) {
            if (!b) { rej(new Error('No se pudo procesar la imagen.')); return; }
            if (b.size > 900000 && q > 0.45) { intento(q - 0.15); return; }
            res({ blob: b, ancho: w, alto: h, bytes: b.size, tipo: b.type });
          }, 'image/webp', q);
        };
        intento(calidad);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
  }
  function aleatorio() { var a = new Uint8Array(12); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function subir(file, tipo) {
    var neg = st.negocio.id, max = tipo === 'logo' ? 512 : 1600;
    say('Subiendo imagen…');
    return comprimir(file, max, 0.8).then(function (img) {
      var ext = /webp/.test(img.tipo) ? 'webp' : /png/.test(img.tipo) ? 'png' : 'jpg', ruta = neg + '/' + aleatorio() + '.' + ext;
      return client().then(function (c) { return c.storage.from('medios').upload(ruta, img.blob, { contentType: img.tipo, upsert: false }); }).then(function (r) {
        if (r.error) { throw r.error; }
        var m = { tipo: tipo, ruta: ruta, ancho: img.ancho, alto: img.alto, bytes: img.bytes };
        var med = (st.datos.medios || []).filter(function (x) { return tipo === 'galeria' || x.tipo !== tipo; }); // logo y portada: una sola
        med.push(m); st.datos.medios = med; say(''); guardar(); pintar();
      });
    }).catch(function (e) { say(e.message && /imagen/.test(e.message) ? e.message : 'No se pudo subir la imagen. ' + errText(e), true); });
  }

  /* ---------- Acciones ---------- */
  function abrirRevision(neg, rev) {
    st.negocio = neg; st.rev = rev; st.datos = JSON.parse(JSON.stringify(rev.datos || {}));
    try { var bk = JSON.parse(localStorage.getItem('nubi.registro.' + rev.id)); if (bk && rev.estado !== 'pendiente' && JSON.stringify(bk) !== JSON.stringify(st.datos) && confirm('Hay cambios guardados solo en este dispositivo. ¿Recuperarlos?')) { st.datos = bk; guardar(true); } } catch (e) { /* sin respaldo */ }
    st.step = rev.estado === 'pendiente' ? 5 : 0; st.view = 'asistente'; st.errors = {}; say(rev.estado === 'requiere_correccion' && rev.motivo ? 'La administración pidió corregir: ' + rev.motivo : '');
    return cargarZonas().then(pintar);
  }
  function crearNegocio() {
    var nombre = ($('#reg-nuevo') || {}).value || '';
    if (nombre.trim().length < 2) { say('Escribe el nombre del negocio (mínimo 2 letras).', true); return; }
    say('Creando…');
    client().then(function (c) { return c.rpc('crear_negocio', { p_municipio: C.municipio, p_nombre: nombre.trim() }); }).then(function (r) {
      if (r.error) { throw r.error; }
      return refrescar().then(function () { var n = st.negocios.filter(function (x) { return x.id === r.data; })[0]; if (n && n.abierta) { return abrirRevision(n, n.abierta); } });
    }).catch(function (e) { say(errText(e), true); });
  }
  function editarPublicado(neg) {
    client().then(function (c) { return c.rpc('nueva_revision', { p_negocio: neg.id }); }).then(function (r) {
      if (r.error) { throw r.error; }
      return refrescar().then(function () { var n = st.negocios.filter(function (x) { return x.id === neg.id; })[0]; if (n && n.abierta) { return abrirRevision(n, n.abierta); } });
    }).catch(function (e) { say(errText(e), true); });
  }
  function enviar() {
    st.errors = validar(st.datos);
    var ks = Object.keys(st.errors);
    if (ks.length) { st.step = pasoDeError(ks[0]); pintar(); say('Falta información obligatoria o hay datos por corregir.', true); return; }
    say('Enviando a revisión…');
    guardar(true).then(client).then(function (c) { return c.rpc('enviar_revision', { p_revision: st.rev.id }); }).then(function (r) {
      if (r.error) { throw r.error; }
      try { localStorage.removeItem('nubi.registro.' + st.rev.id); } catch (e) { /* nada */ }
      st.rev.estado = 'pendiente'; say('¡Enviado! La administración lo revisará. Mientras tanto no se publica nada nuevo.'); pintar();
    }).catch(function (e) { say(errText(e), true); });
  }
  function retirar(neg) {
    if (!confirm('¿Retirar el envío? Volverá a borrador y podrás seguir editándolo.')) { return; }
    client().then(function (c) { return c.rpc('retirar_revision', { p_revision: neg.abierta.id }); }).then(function (r) { if (r.error) { throw r.error; } say('Envío retirado.'); return refrescar(); })
      .catch(function (e) { say(errText(e), true); });
  }
  /* M04: retirar un negocio publicado (deja de verse al instante) y eliminar uno que nunca se publicó. */
  function retirarNegocio(neg) {
    var motivo = prompt('¿Retirar «' + neg.titulo + '» de Nubi? Dejará de verse de inmediato. Puedes escribir el motivo (opcional):', '');
    if (motivo === null) { return; }
    client().then(function (c) { return c.rpc('retirar_negocio', { p_negocio: neg.id, p_motivo: motivo || null }); }).then(function (r) {
      if (r.error) { throw r.error; } say('Retirado: ya no se muestra en Nubi.'); return refrescar();
    }).catch(function (e) { say(errText(e), true); });
  }
  function eliminarBorrador(neg) {
    if (!confirm('¿Eliminar «' + neg.titulo + '» y todo su borrador? Esta acción no se puede deshacer.')) { return; }
    say('Eliminando…');
    client().then(function (c) {
      // Primero las imágenes que subió (Storage); la base de datos no borra archivos.
      return c.from('revisiones').select('datos').eq('negocio_id', neg.id).then(function (r) {
        var rutas = []; (r.data || []).forEach(function (x) { ((x.datos && x.datos.medios) || []).forEach(function (m) { if (m.ruta && rutas.indexOf(m.ruta) === -1) { rutas.push(m.ruta); } }); });
        return rutas.length ? c.storage.from('medios').remove(rutas) : null;
      }).then(function () { return c.rpc('eliminar_borrador', { p_negocio: neg.id }); });
    }).then(function (r) {
      if (r.error) { throw r.error; }
      Object.keys(localStorage).filter(function (k) { return /^nubi\.registro\./.test(k); }).forEach(function (k) { if (neg.abierta && k === 'nubi.registro.' + neg.abierta.id) { localStorage.removeItem(k); } });
      say('Eliminado.'); return refrescar();
    }).catch(function (e) { say(errText(e), true); });
  }
  function refrescar() { return cargarLista().then(function (l) { st.negocios = l; if (st.view === 'lista') { pintar(); } }).catch(function (e) { say(errText(e), true); }); }

  /* ---------- Pintar ---------- */
  function campo(id, label, html, help, err) {
    return '<div class="reg-field">' + '<label for="' + id + '">' + label + '</label>' + html + (help ? '<p class="ed-hint" id="' + id + '-h">' + help + '</p>' : '') +
      (err ? '<p class="reg-err" role="alert">' + esc(err) + '</p>' : '') + '</div>';
  }
  function val(k) { return esc(st.datos[k] || ''); }
  function pintarLista() {
    var l = st.negocios;
    return '<h2 class="reg-h">Mis negocios</h2>' +
      (l.length ? '<ul class="reg-list">' + l.map(function (n) {
        var a = n.abierta, est = a ? ESTADO[a.estado] : ESTADO[n.estado] || n.estado;
        var acts = a && /^(borrador|requiere_correccion)$/.test(a.estado) ? '<button type="button" class="btn" data-reg="abrir" data-id="' + n.id + '">Continuar</button>' :
          a && a.estado === 'pendiente' ? '<button type="button" class="btn btn--ghost" data-reg="ver" data-id="' + n.id + '">Ver envío</button><button type="button" class="btn btn--ghost" data-reg="retirar" data-id="' + n.id + '">Retirar envío</button>' :
          n.estado === 'publicado' || n.estado === 'suspendido' ? '<button type="button" class="btn" data-reg="editar" data-id="' + n.id + '">Proponer cambios</button>' :
          n.estado === 'retirado' && n.publicado_en ? '<button type="button" class="btn btn--ghost" data-reg="editar" data-id="' + n.id + '">Volver a publicar</button>' : '';
        // M04: retirar (propietario, si no está retirado ni suspendido) y eliminar (solo si nunca se publicó)
        var esProp = n.rol === 'propietario';
        if (esProp && n.estado !== 'retirado' && n.estado !== 'suspendido' && n.publicado_en) { acts += '<button type="button" class="btn btn--ghost" data-reg="retirarneg" data-id="' + n.id + '">Retirar de Nubi</button>'; }
        if (esProp && !n.publicado_en && !(a && a.estado === 'pendiente')) { acts += '<button type="button" class="btn btn--ghost" data-reg="eliminar" data-id="' + n.id + '">Eliminar</button>'; }
        return '<li class="reg-item"><div><strong>' + esc(n.titulo) + '</strong><span class="reg-badge reg-badge--' + esc(a ? a.estado : n.estado) + '">' + esc(est) + '</span>' +
          (n.estado === 'publicado' && n.slug ? '<a class="reg-link" href="#/negocio/' + esc(n.slug) + '">Ver ficha pública</a>' : '') +
          (a && a.estado === 'requiere_correccion' && a.motivo ? '<p class="ed-hint">Corrección pedida: ' + esc(a.motivo) + '</p>' : '') +
          (!a && n.ultima && n.ultima.estado === 'rechazada' ? '<p class="ed-hint">Rechazado: ' + esc(n.ultima.motivo || '') + '</p>' : '') +
          (n.estado === 'publicado' && a ? '<p class="ed-hint">La ficha pública sigue mostrando la versión aprobada mientras se revisan los cambios.</p>' : '') +
          (n.estado === 'retirado' ? '<p class="ed-hint">No se muestra en Nubi. Si quieres que se borre por completo, escríbele a la administración; si quieres volver, usa «Volver a publicar».</p>' : '') +
          '</div><div class="auth-acts">' + acts + '</div></li>';
      }).join('') + '</ul>' : '<p>Todavía no tienes negocios registrados.</p>') +
      '<form class="reg-new" id="reg-new-form">' + campo('reg-nuevo', 'Registrar un negocio nuevo', '<input id="reg-nuevo" maxlength="60" autocomplete="organization" placeholder="Ej.: Panadería La Espiga">', 'Después completarás la información en 6 pasos. Puedes guardar y volver cuando quieras.') +
      '<button type="submit" class="btn">Empezar</button></form>';
  }
  function stepper() {
    return '<ol class="reg-steps" aria-label="Pasos">' + STEPS.map(function (s, i) {
      return '<li' + (i === st.step ? ' aria-current="step"' : '') + (i < st.step ? ' class="is-done"' : '') + '><button type="button" data-reg="paso" data-i="' + i + '"><span>' + (i + 1) + '</span>' + esc(s) + '</button></li>';
    }).join('') + '</ol>';
  }
  function pasoBasico(e) {
    var K = Cerca.profiles.KINDS;
    return campo('rb-nombre', 'Nombre comercial <span class="reg-req">obligatorio</span>', '<input id="rb-nombre" data-k="nombre" maxlength="60" value="' + val('nombre') + '" placeholder="Ej.: Panadería La Espiga">', 'Como lo conocen tus clientes.', e.nombre) +
      campo('rb-tipo', 'Tipo de negocio <span class="reg-req">obligatorio</span>', '<select id="rb-tipo" data-k="tipo"><option value="">Elige uno…</option>' + Object.keys(K).map(function (k) {
        return '<option value="' + k + '"' + (st.datos.tipo === k ? ' selected' : '') + '>' + esc(K[k].label) + '</option>'; }).join('') + '</select>', 'Define la categoría en el buscador y el estilo de tu ficha.', e.tipo) +
      campo('rb-frase', 'Frase corta <span class="reg-opt">opcional</span>', '<input id="rb-frase" data-k="frase" maxlength="80" value="' + val('frase') + '" placeholder="Ej.: Pan caliente desde las 5 a. m.">') +
      campo('rb-desc', 'Descripción <span class="reg-opt">opcional</span>', '<textarea id="rb-desc" data-k="descripcion" maxlength="400" placeholder="Qué vendes o qué servicios ofreces">' + val('descripcion') + '</textarea>', 'Ayuda a que te encuentren: menciona productos y servicios.') +
      campo('rb-hist', 'Tu historia <span class="reg-opt">opcional</span>', '<textarea id="rb-hist" data-k="historia" maxlength="400" placeholder="Cómo empezó tu negocio">' + val('historia') + '</textarea>') +
      fotoCampo('logo', 'Logotipo o imagen <span class="reg-opt">opcional</span>');
  }
  function pasoUbicacion(e) {
    var u = st.datos.ubicacion || {};
    return '<fieldset class="reg-radio"><legend>¿Dónde atiendes? <span class="reg-req">obligatorio</span></legend>' +
      '<label><input type="radio" name="ru-modo" value="local"' + (u.modo === 'local' ? ' checked' : '') + '> Tengo un local o punto de atención</label>' +
      '<label><input type="radio" name="ru-modo" value="zona"' + (u.modo === 'zona' ? ' checked' : '') + '> No tengo local: atiendo a domicilio o en una zona</label></fieldset>' +
      (u.modo === 'local' ? '<p class="ed-hint">Toca el mapa para marcar la entrada de tu local. Los clientes podrán pedir una ruta a pie hasta ese punto.</p>' +
        '<div class="reg-map" id="reg-map" aria-label="Mapa para marcar tu local"></div>' +
        '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-reg="miubic">Usar mi ubicación actual</button></div>' +
        '<p class="ed-hint" id="reg-coord">' + (isFinite(u.lat) ? 'Punto marcado.' : 'Aún no has marcado el punto.') + '</p>' +
        campo('ru-dir', 'Dirección pública <span class="reg-opt">opcional</span>', '<input id="ru-dir" data-u="direccion" maxlength="120" value="' + esc(u.direccion || '') + '" placeholder="Ej.: Calle 7 # 5-20, local 2">', 'Si atiendes en tu vivienda, déjala vacía o elige «No tengo local». No publiques una dirección residencial.') : '') +
      (u.modo === 'zona' ? campo('ru-zona', 'Zona de atención', '<select id="ru-zona" data-u="zona_id"><option value="">Elige…</option>' + st.zonas.map(function (z) {
        return '<option value="' + z.id + '"' + (u.zona_id === z.id ? ' selected' : '') + '>' + esc(z.nombre) + '</option>'; }).join('') + '</select>',
        'Solo se mostrará la zona general: nunca tu domicilio ni un punto en el mapa, y no habrá rutas hasta ti.') : '') +
      (e.ubicacion ? '<p class="reg-err" role="alert">' + esc(e.ubicacion) + '</p>' : '');
  }
  function pasoHorario(e) {
    var h = st.datos.horario || { modo: 'fijo', semana: [] };
    var filas = DIAS.map(function (d, i) {
      var fr = (h.semana || []).filter(function (s) { return s.dia === i; });
      var on = fr.length > 0, a = fr[0] || { abre: '08:00', cierra: '18:00' }, b = fr[1];
      return '<li class="reg-dia"><label class="reg-chk"><input type="checkbox" data-dia="' + i + '"' + (on ? ' checked' : '') + '> ' + d + '</label>' +
        (on ? '<span class="reg-horas"><input type="time" aria-label="' + d + ': abre" data-dia="' + i + '" data-f="0abre" value="' + a.abre + '"> a <input type="time" aria-label="' + d + ': cierra" data-dia="' + i + '" data-f="0cierra" value="' + a.cierra + '">' +
          (b ? ' y <input type="time" aria-label="' + d + ': abre (2.ª franja)" data-dia="' + i + '" data-f="1abre" value="' + b.abre + '"> a <input type="time" aria-label="' + d + ': cierra (2.ª franja)" data-dia="' + i + '" data-f="1cierra" value="' + b.cierra + '"> <button type="button" class="reg-mini" data-reg="quitar2" data-dia="' + i + '">Quitar</button>'
            : ' <button type="button" class="reg-mini" data-reg="franja2" data-dia="' + i + '">+ otra franja</button>') + '</span>' : '<span class="ed-hint">Cerrado</span>') + '</li>';
    }).join('');
    return '<fieldset class="reg-radio"><legend>Tipo de horario</legend>' +
      [['fijo', 'Horario fijo por días'], ['con_cita', 'Atiendo con cita previa'], ['variable', 'Horario variable']].map(function (o) {
        return '<label><input type="radio" name="rh-modo" value="' + o[0] + '"' + ((h.modo || 'fijo') === o[0] ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') + '</fieldset>' +
      ((h.modo || 'fijo') === 'fijo' ? '<ul class="reg-dias">' + filas + '</ul><div class="auth-acts"><button type="button" class="btn btn--ghost" data-reg="copiar">Copiar el horario del lunes a martes–viernes</button></div>'
        : '<p class="ed-hint">Tu ficha dirá «' + (h.modo === 'con_cita' ? 'Atiende con cita previa' : 'Horario variable') + '» y nunca «abierto» o «cerrado» automáticamente.</p>') +
      (e.horario ? '<p class="reg-err" role="alert">' + esc(e.horario) + '</p>' : '');
  }
  function pasoContacto(e) {
    var get = function (t) { var c = (st.datos.contactos || []).filter(function (x) { return x.tipo === t; })[0]; return c ? c.valor : ''; };
    var f = [['whatsapp', 'WhatsApp', 'tel', '300 123 4567'], ['telefono', 'Teléfono', 'tel', '300 123 4567'], ['correo', 'Correo', 'email', 'nombre@correo.com'],
      ['instagram', 'Instagram', 'text', 'usuario (sin @)'], ['facebook', 'Facebook', 'text', 'nombre de la página'], ['tiktok', 'TikTok', 'text', 'usuario'], ['web', 'Sitio web', 'url', 'https://…']];
    return '<p class="ed-hint">Todos son opcionales. Solo se mostrará un botón si el dato es válido. Los clientes te escribirán directamente: Nubi no guarda mensajes.</p>' +
      f.map(function (x) {
        var v = get(x[0]), n = v ? S().normalizeContact(x[0], v) : {}, href = n.value ? S().contactHref(x[0], n.value) : '';
        return campo('rc-' + x[0], x[1], '<input id="rc-' + x[0] + '" data-c="' + x[0] + '" type="' + (x[2] === 'url' ? 'text' : x[2]) + '" inputmode="' + (x[2] === 'tel' ? 'tel' : x[2] === 'email' ? 'email' : 'text') + '" value="' + esc(v) + '" placeholder="' + esc(x[3]) + '" autocomplete="off">',
          href ? 'Se abrirá: ' + esc(href) : '', e['c_' + x[0]] || (n.error ? n.error : ''));
      }).join('');
  }
  function fotoCampo(tipo, label) {
    var med = (st.datos.medios || []).filter(function (m) { return m.tipo === tipo; });
    var thumbs = med.map(function (m) { return '<li><img src="' + esc(S().mediaUrl(m.ruta)) + '" alt="' + (tipo === 'logo' ? 'Logotipo' : 'Foto') + '"><button type="button" data-reg="quitarfoto" data-ruta="' + esc(m.ruta) + '" aria-label="Quitar imagen">×</button></li>'; }).join('');
    var lleno = tipo === 'galeria' ? med.length >= MAX_GALERIA : false;
    return '<div class="reg-field"><span class="ed-label">' + label + '</span>' + (thumbs ? '<ul class="ed-thumbs">' + thumbs + '</ul>' : '') +
      (lleno ? '<p class="ed-hint">Máximo ' + MAX_GALERIA + ' fotos.</p>' : '<input type="file" accept="image/*" data-foto="' + tipo + '" aria-label="' + (tipo === 'logo' ? 'Elegir logotipo' : tipo === 'portada' ? 'Elegir portada' : 'Añadir foto') + '">') +
      '<p class="ed-hint">Se reduce en tu teléfono antes de subirla. Se publica solo cuando se apruebe.</p></div>';
  }
  function pasoOferta() {
    var of = st.datos.ofertas || [];
    return '<h3 class="reg-sub">Productos o servicios destacados</h3>' +
      '<ul class="ed-items">' + of.map(function (o, i) {
        return '<li class="reg-oferta"><input data-o="' + i + '" data-f="nombre" maxlength="60" value="' + esc(o.nombre || '') + '" placeholder="Nombre (ej.: Pan de bono)" aria-label="Nombre del producto ' + (i + 1) + '">' +
          '<input data-o="' + i + '" data-f="detalle" maxlength="120" value="' + esc(o.detalle || '') + '" placeholder="Detalle (opcional)" aria-label="Detalle del producto ' + (i + 1) + '">' +
          '<input data-o="' + i + '" data-f="precio_texto" maxlength="30" value="' + esc(o.precio_texto || '') + '" placeholder="Precio (opcional, ej.: $2.000)" aria-label="Precio del producto ' + (i + 1) + '">' +
          '<button type="button" class="ed-item-del" data-reg="quitaroferta" data-i="' + i + '">Quitar</button></li>';
      }).join('') + '</ul>' +
      (of.length < MAX_OFERTAS ? '<button type="button" class="btn btn--ghost" data-reg="oferta">Añadir producto o servicio</button>' : '') +
      '<h3 class="reg-sub">Fotos</h3>' + fotoCampo('portada', 'Foto de portada <span class="reg-opt">opcional</span>') + fotoCampo('galeria', 'Galería (hasta ' + MAX_GALERIA + ') <span class="reg-opt">opcional</span>') +
      '<h3 class="reg-sub">Domicilios y pagos <span class="reg-opt">informativo</span></h3>' +
      '<label class="reg-chk"><input type="checkbox" data-k2="domicilio"' + (st.datos.domicilio ? ' checked' : '') + '> Hago domicilios</label>' +
      '<fieldset class="reg-radio"><legend>Medios de pago que aceptas</legend>' + PAGOS.map(function (p) {
        return '<label class="reg-chk"><input type="checkbox" data-pago="' + p + '"' + ((st.datos.medios_pago || []).indexOf(p) !== -1 ? ' checked' : '') + '> ' + p + '</label>'; }).join('') + '</fieldset>' +
      '<p class="ed-hint">Nubi no procesa pagos: solo informa a tus clientes.</p>';
  }
  function pasoVista() {
    var errs = validar(st.datos), n = Object.keys(errs).length, rev = st.rev;
    var zona = st.zonas.filter(function (z) { return st.datos.ubicacion && z.id === st.datos.ubicacion.zona_id; })[0];
    var b = S().normalize(S().fromDatos(st.datos, { zonaNombre: zona && zona.nombre }), 'revision');
    var html = Cerca.profiles.render(b, Cerca.app.profileHelpers(true));
    return (n ? '<div class="reg-falta" role="alert"><strong>Antes de enviar:</strong><ul>' + Object.keys(errs).map(function (k) {
        return '<li><button type="button" class="reg-mini" data-reg="paso" data-i="' + pasoDeError(k) + '">' + esc(errs[k]) + '</button></li>'; }).join('') + '</ul></div>' : '') +
      '<p class="ed-hint">Así verán tu negocio los clientes cuando se apruebe. Puedes volver a cualquier paso.</p>' +
      '<div class="reg-preview">' + html + '</div>' +
      (rev.estado === 'pendiente' ? '<p class="auth-msg">Enviado: en revisión. No puedes editarlo mientras se revisa; si necesitas cambiar algo, retira el envío desde «Mis negocios».</p>'
        : '<div class="auth-acts"><button type="button" class="btn" data-reg="enviar"' + (n ? ' aria-disabled="true"' : '') + '>Enviar a revisión</button></div>');
  }
  function pintar() {
    var r = root(); if (!r) { return; }
    if (st.view === 'lista') {
      r.innerHTML = '<p class="auth-msg" id="reg-msg"' + (st.msg ? '' : ' hidden') + '>' + esc(st.msg) + '</p>' + pintarLista();
      return;
    }
    var e = st.errors, bloqueado = st.rev.estado === 'pendiente';
    var cuerpo = [pasoBasico, pasoUbicacion, pasoHorario, pasoContacto, pasoOferta, pasoVista][st.step](e);
    r.innerHTML = '<div class="reg-top"><button type="button" class="btn btn--ghost" data-reg="volver">← Mis negocios</button><span class="ed-status" id="reg-saved" role="status"></span></div>' +
      '<h2 class="reg-h">' + esc(st.datos.nombre || 'Tu negocio') + ' <span class="reg-badge reg-badge--' + esc(st.rev.estado) + '">' + esc(ESTADO[st.rev.estado]) + '</span></h2>' +
      stepper() + '<p class="reg-prog">Paso ' + (st.step + 1) + ' de ' + STEPS.length + '</p>' +
      '<p class="auth-msg' + (st.msgErr ? ' is-error' : '') + '" id="reg-msg"' + (st.msg ? '' : ' hidden') + '>' + esc(st.msg) + '</p>' +
      '<section class="reg-step" aria-labelledby="reg-step-h"><h3 id="reg-step-h" tabindex="-1">' + esc(STEPS[st.step]) + '</h3>' +
      (bloqueado && st.step < 5 ? '<fieldset disabled class="reg-lock">' + cuerpo + '</fieldset>' : cuerpo) + '</section>' +
      '<div class="reg-nav">' + (st.step > 0 ? '<button type="button" class="btn btn--ghost" data-reg="atras">Atrás</button>' : '<span></span>') +
      (st.step < STEPS.length - 1 ? '<button type="button" class="btn" data-reg="siguiente">Siguiente</button>' : '') + '</div>';
    if (st.step === 1 && st.datos.ubicacion && st.datos.ubicacion.modo === 'local') { montarMapa(); }
  }
  function irA(i) {
    st.step = Math.max(0, Math.min(STEPS.length - 1, i)); pintar();
    var h = $('#reg-step-h'); if (h) { h.focus({ preventScroll: true }); }
    var top = root().getBoundingClientRect().top + window.scrollY - 80; if (window.scrollY > top) { window.scrollTo(0, top); }
  }

  /* Mapa pequeño para marcar el local (usa MapLibre si ya cargó; si no, solo «Usar mi ubicación actual»). */
  function montarMapa() {
    var box = $('#reg-map'), ML = window.maplibregl, u = st.datos.ubicacion;
    if (miniMap) { try { miniMap.remove(); } catch (e) { /* nada */ } miniMap = null; }
    if (!box || !ML) { if (box) { box.innerHTML = '<p class="ed-hint">El mapa no está disponible. Usa «Usar mi ubicación actual» estando en tu local.</p>'; box.classList.add('is-off'); } return; }
    var dark = document.documentElement.dataset.theme === 'dark', center = isFinite(u.lat) ? [u.lng, u.lat] : C.mapCenter;
    miniMap = new ML.Map({ container: box, style: dark ? C.mapStyleDark : C.mapStyleUrl, center: center, zoom: isFinite(u.lat) ? 17 : C.mapZoom, attributionControl: { compact: true } });
    miniMap.addControl(new ML.NavigationControl({ showCompass: false }), 'top-right');
    var marcar = function (lng, lat) {
      u.lat = +lat.toFixed(6); u.lng = +lng.toFixed(6);
      if (!miniMarker) { miniMarker = new ML.Marker({ color: '#E4572E' }); }
      miniMarker.setLngLat([u.lng, u.lat]).addTo(miniMap);
      var c = $('#reg-coord'); if (c) { c.textContent = 'Punto marcado. Puedes tocar otro lugar para moverlo.'; }
      guardar();
    };
    miniMarker = null;
    if (isFinite(u.lat)) { marcar(u.lng, u.lat); }
    miniMap.on('click', function (ev) { marcar(ev.lngLat.lng, ev.lngLat.lat); });
    Cerca.registro._marcar = marcar; // pruebas
  }

  /* ---------- Eventos ---------- */
  function ponerContacto(tipo, valor) {
    var l = (st.datos.contactos || []).filter(function (c) { return c.tipo !== tipo; }), n = S().normalizeContact(tipo, valor);
    if (String(valor).trim()) { l.push({ tipo: tipo, valor: n.value || String(valor).trim() }); } // se guarda aunque esté mal; el envío lo bloquea
    st.datos.contactos = l;
  }
  function semana() { var h = st.datos.horario = st.datos.horario || { modo: 'fijo', semana: [] }; h.semana = h.semana || []; return h; }
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!root() || !root().contains(t)) { return; }
    if (t.dataset.k) { st.datos[t.dataset.k] = t.value; if (t.dataset.k === 'tipo') { var k = Cerca.profiles.KINDS[t.value]; st.datos.categoria = k ? k.category : ''; st.datos.icono = k ? k.icon : null; } guardar(); }
    if (t.dataset.u) { st.datos.ubicacion = st.datos.ubicacion || {}; st.datos.ubicacion[t.dataset.u] = t.value || undefined; guardar(); }
    if (t.dataset.o) { var o = st.datos.ofertas[+t.dataset.o]; o[t.dataset.f] = t.value; guardar(); }
    if (t.dataset.f && t.dataset.dia && t.type === 'time') {
      var i = +t.dataset.dia, idx = +t.dataset.f[0], f = t.dataset.f.slice(1), fr = semana().semana.filter(function (s) { return s.dia === i; });
      if (fr[idx]) { fr[idx][f] = t.value; guardar(); }
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!root() || !root().contains(t)) { return; }
    if (t.name === 'ru-modo') { st.datos.ubicacion = t.value === 'zona' ? { modo: 'zona', zona_id: (st.zonas[0] || {}).id } : { modo: 'local' }; guardar(); pintar(); }
    if (t.name === 'rh-modo') { var h = semana(); h.modo = t.value; if (t.value !== 'fijo') { h.semana = []; } guardar(); pintar(); }
    if (t.type === 'checkbox' && t.dataset.dia) {
      var hh = semana(), i = +t.dataset.dia; hh.modo = 'fijo'; hh.semana = hh.semana.filter(function (s) { return s.dia !== i; });
      if (t.checked) { hh.semana.push({ dia: i, abre: '08:00', cierra: '18:00' }); hh.semana.sort(function (a, b) { return a.dia - b.dia || (a.abre < b.abre ? -1 : 1); }); }
      guardar(); pintar();
    }
    if (t.dataset.c) { ponerContacto(t.dataset.c, t.value); guardar(); pintar(); var nx = $('#rc-' + t.dataset.c); if (nx) { nx.focus(); } }
    if (t.dataset.k2) { st.datos[t.dataset.k2] = t.checked; guardar(); }
    if (t.dataset.pago) { var mp = (st.datos.medios_pago || []).filter(function (p) { return p !== t.dataset.pago; }); if (t.checked) { mp.push(t.dataset.pago); } st.datos.medios_pago = mp; guardar(); }
    if (t.dataset.foto && t.files && t.files[0]) { subir(t.files[0], t.dataset.foto); }
  });
  document.addEventListener('submit', function (ev) {
    if (ev.target && ev.target.id === 'reg-new-form') { ev.preventDefault(); crearNegocio(); }
  });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-reg]'); if (!b || !root() || !root().contains(b)) { return; }
    var a = b.dataset.reg, neg = function () { return st.negocios.filter(function (n) { return n.id === b.dataset.id; })[0]; };
    if (a === 'abrir' || a === 'ver') { var n = neg(); if (n && n.abierta) { abrirRevision(n, n.abierta); } }
    if (a === 'editar') { editarPublicado(neg()); }
    if (a === 'retirar') { retirar(neg()); }
    if (a === 'retirarneg') { retirarNegocio(neg()); }
    if (a === 'eliminar') { eliminarBorrador(neg()); }
    if (a === 'volver') { guardar(true); st.view = 'lista'; st.rev = null; say(''); refrescar(); pintar(); }
    if (a === 'paso') { irA(+b.dataset.i); }
    if (a === 'siguiente') { irA(st.step + 1); }
    if (a === 'atras') { irA(st.step - 1); }
    if (a === 'enviar') { enviar(); }
    if (a === 'miubic') { Cerca.geo.locate().then(function (p) { st.datos.ubicacion = Object.assign(st.datos.ubicacion || {}, { modo: 'local', lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }); guardar(); pintar(); }, function (e) { say(e.message, true); }); }
    if (a === 'franja2') { var h = semana(), i = +b.dataset.dia; h.semana.push({ dia: i, abre: '14:00', cierra: '18:00' }); h.semana.sort(function (x, y) { return x.dia - y.dia || (x.abre < y.abre ? -1 : 1); }); guardar(); pintar(); }
    if (a === 'quitar2') { var h2 = semana(), d = +b.dataset.dia, k = 0; h2.semana = h2.semana.filter(function (s) { return s.dia !== d || k++ === 0; }); guardar(); pintar(); }
    if (a === 'copiar') { var h3 = semana(), lun = h3.semana.filter(function (s) { return s.dia === 1; }); if (!lun.length) { say('Primero marca el lunes con su horario.', true); return; }
      h3.semana = h3.semana.filter(function (s) { return s.dia < 2 || s.dia > 5; }); [2, 3, 4, 5].forEach(function (dd) { lun.forEach(function (s) { h3.semana.push({ dia: dd, abre: s.abre, cierra: s.cierra }); }); });
      h3.semana.sort(function (x, y) { return x.dia - y.dia || (x.abre < y.abre ? -1 : 1); }); guardar(); pintar(); }
    if (a === 'oferta') { st.datos.ofertas = (st.datos.ofertas || []).concat([{ nombre: '', detalle: '', precio_texto: '' }]); pintar(); var ins = root().querySelectorAll('[data-o][data-f="nombre"]'); if (ins.length) { ins[ins.length - 1].focus(); } }
    if (a === 'quitaroferta') { st.datos.ofertas.splice(+b.dataset.i, 1); guardar(); pintar(); }
    if (a === 'quitarfoto') { st.datos.medios = (st.datos.medios || []).filter(function (m) { return m.ruta !== b.dataset.ruta; }); guardar(); pintar(); }
  });
  // Antes de guardar, las ofertas vacías se descartan (la base de datos exige nombre).
  var guardarBase = guardar;
  guardar = function (inm) { if (st.datos && st.datos.ofertas) { st.datos.ofertas = st.datos.ofertas.filter(function (o, i, arr) { return o.nombre || i === arr.length - 1; }); } return guardarBase(inm); };

  /* ---------- Montaje: con sesión se muestra el registro; sin sesión, el editor local de siempre ---------- */
  function sync(s) {
    var v = $('#view-owner'), r = root(); if (!v || !r) { return; }
    var on = s.status === 'signed_in';
    v.classList.toggle('is-registro', on); r.hidden = !on;
    var note = $('#owner-notice');
    if (note) { note.textContent = on ? 'Entorno de prueba: lo que registres se guarda como borrador en el servidor de pruebas y solo se publica en esta app cuando la administración lo aprueba.' : note.dataset.base; }
    if (on && !r.dataset.listo) { r.dataset.listo = '1'; st.view = 'lista'; r.innerHTML = '<p class="ed-hint" role="status">Cargando tus negocios…</p>'; refrescar(); }
    if (!on) { r.dataset.listo = ''; st.view = 'lista'; st.negocios = []; st.rev = null; }
  }
  function init() { var note = $('#owner-notice'); if (note && !note.dataset.base) { note.dataset.base = note.textContent; } if (Cerca.auth) { Cerca.auth.onChange(sync); sync(Cerca.auth.state()); } }
  if (Cerca.app) { init(); } else { document.addEventListener('nubi:app-lista', init, { once: true }); }

  Cerca.registro = { estado: function () { return st; }, validar: validar, refrescar: refrescar, abrirRevision: abrirRevision, irA: irA, guardar: function () { return guardar(true); }, _marcar: null };
})();
