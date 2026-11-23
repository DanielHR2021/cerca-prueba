/* Reportar un negocio publicado (Google Play: contenido generado por usuarios). Sin cuenta o con cuenta.
   Abre un diálogo nativo, envía reportar_negocio (0007) y nunca pide datos de contacto. La administración los ve en
   #/admin («Reportes pendientes»). Si la función aún no existe en el servidor, se ofrece el correo de contacto. */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var MOTIVOS = [
    ['informacion_incorrecta', 'Información incorrecta (horario, dirección, contacto…)'],
    ['foto_inapropiada', 'Foto inapropiada o de otra persona'],
    ['contenido_inapropiado', 'Contenido ofensivo, engañoso o ilegal'],
    ['suplantacion', 'Se hace pasar por otro negocio o persona'],
    ['negocio_inexistente', 'El negocio no existe o cerró'],
    ['otro', 'Otro (descríbelo)']
  ];
  var CORREO = 'herreraroldand@gmail.com';
  var actual = null;

  function dialogo() {
    var d = $('#rep-dlg');
    if (d) { return d; }
    d = document.createElement('dialog'); d.id = 'rep-dlg'; d.className = 'rep-dlg'; d.setAttribute('aria-labelledby', 'rep-t');
    document.body.appendChild(d);
    return d;
  }
  function abrir(uid, nombre) {
    actual = { uid: uid, nombre: nombre };
    var d = dialogo();
    d.innerHTML = '<form method="dialog" id="rep-form"><h2 id="rep-t">Reportar «' + esc(nombre) + '»</h2>' +
      '<fieldset><legend>¿Qué pasa?</legend>' + MOTIVOS.map(function (m, i) {
        return '<label class="rep-op"><input type="radio" name="rep-motivo" value="' + m[0] + '"' + (i === 0 ? ' checked' : '') + '> <span>' + esc(m[1]) + '</span></label>';
      }).join('') + '</fieldset>' +
      '<label for="rep-det">Detalle (opcional)</label><textarea id="rep-det" maxlength="500" rows="3" placeholder="Ej.: El horario de los domingos no es correcto"></textarea>' +
      '<p class="ed-hint">No escribas datos personales (teléfonos, direcciones o nombres de otras personas). La administración revisa cada reporte; no te responderemos por aquí.</p>' +
      '<p class="auth-msg" id="rep-msg" hidden></p>' +
      '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-rep="cancelar">Cancelar</button><button type="button" class="btn" data-rep="enviar">Enviar reporte</button></div></form>';
    if (d.showModal) { d.showModal(); } else { d.setAttribute('open', ''); }
    var r = $('input[name=rep-motivo]', d); if (r) { r.focus(); }
  }
  function msg(t, err) { var m = $('#rep-msg'); if (!m) { return; } m.textContent = t; m.hidden = !t; m.className = 'auth-msg' + (err ? ' is-error' : ''); }
  function cerrar() { var d = $('#rep-dlg'); if (d) { if (d.close) { d.close(); } else { d.removeAttribute('open'); } } }
  function enviar() {
    var motivo = ($('input[name=rep-motivo]:checked') || {}).value, det = ($('#rep-det') || {}).value || '';
    if (motivo === 'otro' && !det.trim()) { msg('Describe brevemente el problema.', true); return; }
    msg('Enviando…');
    Cerca.auth.ready().then(function (c) { return c.rpc('reportar_negocio', { p_negocio: actual.uid, p_motivo: motivo, p_detalle: det.trim() || null }); })
      .then(function (r) {
        if (r.error) { throw r.error; }
        msg('Gracias. La administración revisará tu reporte.');
        setTimeout(cerrar, 1600);
      }).catch(function (e) {
        var m = (e && e.message) || '';
        if (/function|schema cache|does not exist|404/i.test(m)) { msg('Por ahora escribe a ' + CORREO + ' con el asunto «Reporte – Nubi» y el nombre del negocio.', true); return; }
        msg(/reportaste|muchos reportes|publicados|Describe|500/.test(m) ? m : 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.', true);
      });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-reportar]');
    if (b) { abrir(b.dataset.reportar, b.dataset.nombre || 'este negocio'); return; }
    var a = e.target.closest('[data-rep]'); if (!a) { return; }
    if (a.dataset.rep === 'cancelar') { cerrar(); }
    if (a.dataset.rep === 'enviar') { enviar(); }
  });
  Cerca.reportes = { abrir: abrir, MOTIVOS: MOTIVOS };
})();
