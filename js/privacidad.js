/* L02 · Privacidad y cuenta. Ruta #/privacidad y sección «Cuenta» de Ajustes.
   Tres piezas DISTINTAS (no basta una casilla):
   - Aviso de privacidad: se muestra antes de pedir datos (al entrar) y en esta página. No se guarda nada.
   - Autorización de tratamiento de datos (Ley 1581, art. 9) y aceptación de los términos de uso: casillas separadas;
     la base de datos guarda quién, cuándo y qué versión (aceptar_documentos). Sin ellas no se crean ni envían negocios.
   - Política completa y términos: texto en esta página.
   Los textos son un BORRADOR técnico pendiente de revisión jurídica (docs/legal/). La versión debe coincidir con
   public.documentos_legales; si el servidor no tiene ninguna vigente, la app no pide la autorización.
   «Eliminar mi cuenta»: borra las fotos de los negocios que se eliminan y llama eliminar_mi_cuenta (0006). */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var VERSION = '2026-11-23-v1';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var RESP = 'Daniel Nicolás Herrera Roldán (persona natural; Nubi es su marca), herreraroldand@gmail.com, +57 318 556 4988';

  var AVISO = '<p><strong>Aviso de privacidad.</strong> Para explorar Nubi no te pedimos datos. Si entras con Google para registrar un negocio, recibimos tu correo, nombre y foto de perfil para identificarte y dejar constancia de tus cambios. Tu ubicación solo se usa en tu teléfono (no la guardamos) y, si pides una ruta a pie, se envía al servicio de rutas de OpenStreetMap. Puedes conocer, corregir o pedir la eliminación de tus datos. Responsable: Daniel Nicolás Herrera Roldán (Nubi), herreraroldand@gmail.com. <a href="privacidad.html">Política completa</a> · <a href="terminos.html">Términos</a>.</p>';

  var POLITICA = [
    ['Quién es el responsable', 'Nubi, plataforma de negocios locales que empieza en Roldanillo (Valle del Cauca). Responsable: ' + RESP + '.'],
    ['Si solo exploras', 'No pedimos datos personales. Si tocas «Mi ubicación», tu posición se usa en tu dispositivo para el mapa y las distancias; no la guardamos ni la enviamos a nuestros servidores, y no usamos tu IP para ubicarte. Si pides una ruta a pie, el punto de partida y el destino se envían al servicio de rutas de OpenStreetMap (FOSSGIS, Alemania). «Abrir en Google Maps» abre Google Maps solo con el destino.'],
    ['En tu dispositivo', 'Guardamos solo en tu navegador: favoritos, tema, borradores del registro, tu sesión y una copia de la lista pública de negocios para usar la app sin conexión (máximo 7 días). Los borras desde el navegador.'],
    ['Si tienes cuenta', 'Al entrar con Google recibimos tu correo, nombre, foto de perfil y un identificador; el servicio de cuentas guarda además fechas de acceso y registros técnicos (pueden incluir tu IP). No recibimos tu contraseña. Los usamos para identificarte, permitirte administrar tus negocios, evitar abusos y dejar constancia de quién hizo cada cambio.'],
    ['Tus negocios', 'Lo que apruebe la administración se publica: nombre, descripción, horarios, contactos que elijas, ofertas, ubicación (punto o solo zona general) y fotos. Las fotos se reducen en tu teléfono (se quitan sus metadatos, incluida la ubicación de la cámara) y al publicarse son públicas. Publica solo datos tuyos o autorizados; no publiques tu dirección de vivienda.'],
    ['Con quién se comparte', 'Supabase (base de datos, cuentas y fotos; EE. UU.), Google (inicio de sesión), GitHub Pages (alojamiento; EE. UU.), OpenFreeMap/OpenStreetMap (mapa), FOSSGIS (rutas, si las pides), Google Fonts, jsDelivr y unpkg (programas y tipografías). No vendemos datos, no hay publicidad ni analítica, ni inteligencia artificial con tus datos.'],
    ['Tus derechos', 'Conocer, actualizar, rectificar, pedir prueba de tu autorización, revocarla y pedir la supresión de tus datos, y quejarte ante la Superintendencia de Industria y Comercio. En la app puedes corregir o retirar tus negocios y eliminar tu cuenta (Ajustes → Cuenta). Para lo demás, escribe a herreraroldand@gmail.com con el asunto «Datos personales – Nubi»: las consultas se responden en máximo 10 días hábiles y los reclamos en máximo 15.'],
    ['Conservación', 'Los negocios se muestran mientras estén publicados. Al eliminar un negocio o tu cuenta se borran sus datos; el registro de acciones conserva el nombre del negocio, la fecha y el motivo como constancia, sin tus datos de cuenta. Los reportes de contenido (motivo y detalle, sin datos de contacto) solo los ve la administración. Las copias de seguridad se guardan en privado.'],
    ['Seguridad', 'Reglas en la base de datos impiden que alguien modifique lo ajeno o vea lo pendiente; la conexión es cifrada. Ningún sistema es infalible: si un incidente te afecta, te avisaremos.'],
    ['Menores de edad', 'Nubi no está dirigida a menores; solo personas mayores de edad registran negocios.']
  ];
  var TERMINOS = [
    'Registras solo negocios reales que administras o para los que tienes autorización.',
    'La información debe ser verdadera y estar al día. Nada se publica sin la revisión de la administración, que puede pedir correcciones, rechazar o suspender un negocio indicando el motivo.',
    'No publiques datos personales de otras personas, fotos de personas sin su permiso, de menores, ni contenido engañoso, ofensivo o ilegal.',
    'Puedes retirar tu negocio cuando quieras y pedir su eliminación, o eliminar tu cuenta.',
    'Nubi es un servicio gratuito en fase de prueba: puede cambiar o interrumpirse. Cada negocio responde por lo que publica y por lo que ofrece a sus clientes.'
  ];

  function pagina() {
    var v = $('#privacidad'); if (!v) { return; }
    v.innerHTML = '<p class="notice">Borrador pendiente de revisión jurídica · versión ' + esc(VERSION) + '. No es la versión definitiva.</p>' +
      '<section class="panel-card"><h2>Documentos completos</h2><p><a href="privacidad.html">Política de tratamiento de datos</a> · <a href="terminos.html">Términos y condiciones</a> · <a href="eliminar-cuenta.html">Eliminar tu cuenta y tus datos</a></p><p>Contacto: <a href="mailto:herreraroldand@gmail.com">herreraroldand@gmail.com</a> · +57 318 556 4988</p></section>' +
      '<section class="panel-card">' + AVISO + '</section>' +
      '<section class="panel-card"><h2 id="politica">Política de tratamiento de datos</h2>' + POLITICA.map(function (p) { return '<h3>' + esc(p[0]) + '</h3><p>' + esc(p[1]) + '</p>'; }).join('') + '</section>' +
      '<section class="panel-card"><h2 id="terminos">Términos de uso</h2><ol>' + TERMINOS.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol></section>';
  }

  /* ---------- Autorización (para registro.js) ---------- */
  // { vigente: 'versión'|null, aceptada: bool, distinta: bool } — distinta: el servidor pide otra versión (app vieja).
  function estado(c) {
    return c.rpc('version_vigente').then(function (r) {
      if (r.error) { throw r.error; }
      var v = r.data || null; if (!v) { return { vigente: null, aceptada: true, distinta: false }; }
      return c.rpc('tiene_autorizacion').then(function (t) { if (t.error) { throw t.error; } return { vigente: v, aceptada: !!t.data, distinta: v !== VERSION }; });
    });
  }
  function tarjeta(e) {
    if (e.distinta) { return '<section class="panel-card priv-card" id="priv-card"><p class="auth-msg is-error" role="alert">Los documentos cambiaron. Recarga la app para leer la versión nueva antes de continuar.</p></section>'; }
    return '<section class="panel-card priv-card" id="priv-card" aria-labelledby="priv-t"><h2 id="priv-t" class="reg-h">Antes de registrar tu negocio</h2>' + AVISO +
      '<label class="priv-check"><input type="checkbox" id="priv-datos"> <span>Autorizo el tratamiento de mis datos personales a Daniel Nicolás Herrera Roldán, responsable de Nubi, para las finalidades descritas en la <a href="privacidad.html">Política de tratamiento de datos</a>, incluida su transferencia a los proveedores fuera de Colombia que allí se indican.</span></label>' +
      '<label class="priv-check"><input type="checkbox" id="priv-terminos"> <span>Acepto los <a href="terminos.html">Términos y condiciones</a> y declaro que soy mayor de edad.</span></label>' +
      '<p class="auth-msg" id="priv-msg" hidden></p>' +
      '<div class="auth-acts"><button type="button" class="btn" data-priv="aceptar">Continuar</button></div>' +
      '<p class="ed-hint">Queda constancia de la fecha y la versión. Puedes revocarla eliminando tu cuenta (Ajustes → Cuenta).</p></section>';
  }
  function aceptar() {
    var d = $('#priv-datos'), t = $('#priv-terminos'), m = $('#priv-msg');
    var msg = function (s, err) { m.textContent = s; m.hidden = !s; m.className = 'auth-msg' + (err ? ' is-error' : ''); };
    if (!d.checked || !t.checked) { msg('Marca las dos casillas para continuar. Son independientes: la autorización de datos y los términos.', true); return; }
    msg('Guardando…');
    Cerca.auth.ready().then(function (c) { return c.rpc('aceptar_documentos', { p_version: VERSION, p_tratamiento: true, p_terminos: true }); }).then(function (r) {
      if (r.error) { throw r.error; }
      if (Cerca.registro) { return Cerca.registro.refrescar(); }
    }).catch(function (e) { msg('No se pudo guardar: ' + ((e && e.message) || 'inténtalo de nuevo'), true); });
  }

  /* ---------- Cuenta (Ajustes): eliminar mi cuenta ---------- */
  var cuenta = { paso: 0, negocios: [], admin: false, msg: '', err: false };
  function pintarCuenta() {
    var box = $('#cuenta-box'); if (!box) { return; }
    var a = Cerca.auth && Cerca.auth.state(), on = a && a.status === 'signed_in';
    var msg = cuenta.msg ? '<p class="auth-msg' + (cuenta.err ? ' is-error' : '') + '" role="alert">' + esc(cuenta.msg) + '</p>' : '';
    if (!on) { box.innerHTML = '<p>Para explorar no necesitas cuenta. Si administras un negocio, entra desde <a href="#/mi-negocio">Negocio</a>.</p>' + msg; return; }
    if (cuenta.admin) { box.innerHTML = '<p>Sesión iniciada como <strong>' + esc(a.user.email) + '</strong> (administración).</p><p class="ed-hint">Las cuentas de administración no se eliminan desde la app.</p>' + msg; return; }
    if (cuenta.paso === 0) {
      box.innerHTML = '<p>Sesión iniciada como <strong>' + esc(a.user.email) + '</strong>.</p>' + msg +
        '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-cuenta="iniciar">Eliminar mi cuenta</button></div>';
      return;
    }
    var l = cuenta.negocios;
    box.innerHTML = '<h3>Eliminar mi cuenta</h3><p>Se borrarán tu cuenta, tu autorización y tus membresías. ' +
      (l.length ? 'También se eliminarán, con sus fotos, estos negocios de los que eres la única persona propietaria:</p><ul>' + l.map(function (n) { return '<li>' + esc(n.nombre || 'Negocio sin nombre') + '</li>'; }).join('') + '</ul>' : 'No tienes negocios que se eliminen.</p>') +
      '<p class="ed-hint">No se puede deshacer. Queda solo una constancia sin tus datos (fecha y nombre de los negocios eliminados).</p>' +
      '<div class="reg-field"><label for="cuenta-confirma">Escribe ELIMINAR para confirmar</label><input id="cuenta-confirma" autocomplete="off" autocapitalize="characters"></div>' + msg +
      '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-cuenta="cancelar">Cancelar</button><button type="button" class="btn btn--danger" data-cuenta="confirmar">Eliminar definitivamente</button></div>';
  }
  function setCuenta(o) { Object.assign(cuenta, o); pintarCuenta(); }
  function iniciar() {
    setCuenta({ msg: 'Revisando tus negocios…', err: false });
    Cerca.auth.ready().then(function (c) {
      return c.rpc('negocios_a_eliminar_con_mi_cuenta').then(function (r) {
        if (r.error) { throw r.error; }
        var ids = (r.data || []).map(function (x) { return typeof x === 'string' ? x : x.negocios_a_eliminar_con_mi_cuenta; });
        if (!ids.length) { return []; }
        return c.from('negocios').select('id, nombre').in('id', ids).then(function (n) { if (n.error) { throw n.error; } return n.data || []; });
      });
    }).then(function (l) { setCuenta({ paso: 1, negocios: l, msg: '' }); }, function (e) { setCuenta({ msg: 'No se pudo revisar: ' + ((e && e.message) || ''), err: true }); });
  }
  function rutasDeFotos(c, ids) {
    if (!ids.length) { return Promise.resolve([]); }
    return Promise.all([
      c.from('medios').select('ruta').in('negocio_id', ids),
      c.from('revisiones').select('datos').in('negocio_id', ids)
    ]).then(function (r) {
      var rutas = ((r[0] && r[0].data) || []).map(function (m) { return m.ruta; });
      ((r[1] && r[1].data) || []).forEach(function (x) { ((x.datos && x.datos.medios) || []).forEach(function (m) { if (m.ruta) { rutas.push(m.ruta); } }); });
      return rutas.filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    });
  }
  function confirmar() {
    var t = ($('#cuenta-confirma') || {}).value || '';
    if (t.trim() !== 'ELIMINAR') { setCuenta({ msg: 'Escribe ELIMINAR (en mayúsculas) para confirmar.', err: true }); return; }
    setCuenta({ msg: 'Eliminando…', err: false });
    var cli;
    Cerca.auth.ready().then(function (c) {
      cli = c;
      return rutasDeFotos(c, cuenta.negocios.map(function (n) { return n.id; }));
    }).then(function (rutas) {
      return rutas.length ? cli.storage.from('medios').remove(rutas).then(function (r) { if (r && r.error) { throw r.error; } }) : null;
    }).then(function () { return cli.rpc('eliminar_mi_cuenta', { p_confirmacion: 'ELIMINAR' }); }).then(function (r) {
      if (r.error) { throw r.error; }
      try { Object.keys(localStorage).filter(function (k) { return /^nubi\.registro\./.test(k); }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* nada */ }
      return Cerca.auth.signOut().catch(function () { /* la sesión ya no es válida */ });
    }).then(function () { setCuenta({ paso: 0, negocios: [], msg: 'Tu cuenta fue eliminada. Gracias por usar Nubi.', err: false }); }, function (e) {
      setCuenta({ msg: 'No se pudo eliminar: ' + ((e && e.message) || 'inténtalo de nuevo') + '. No se borró tu cuenta.', err: true });
    });
  }
  document.addEventListener('click', function (e) {
    var p = e.target.closest('[data-priv]'); if (p && p.dataset.priv === 'aceptar') { aceptar(); }
    var b = e.target.closest('[data-cuenta]'); if (!b) { return; }
    if (b.dataset.cuenta === 'iniciar') { iniciar(); }
    if (b.dataset.cuenta === 'cancelar') { setCuenta({ paso: 0, msg: '' }); }
    if (b.dataset.cuenta === 'confirmar') { confirmar(); }
  });
  function onAuth(s) {
    if (s.status !== 'signed_in') { cuenta.admin = false; cuenta.paso = 0; pintarCuenta(); return; }
    Cerca.auth.ready().then(function (c) { return c.rpc('es_admin'); }).then(function (r) { cuenta.admin = !!(r && r.data); pintarCuenta(); }, function () { pintarCuenta(); });
  }
  function init() { pagina(); pintarCuenta(); if (Cerca.auth) { Cerca.auth.onChange(onAuth); } }
  if (Cerca.app) { init(); } else { document.addEventListener('nubi:app-lista', init, { once: true }); }

  Cerca.privacidad = { VERSION: VERSION, AVISO: AVISO, estado: estado, tarjeta: tarjeta, pintarCuenta: pintarCuenta, _cuenta: function () { return cuenta; } };
})();
