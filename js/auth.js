/* Cuentas de comerciantes (Etapa 1, T5). Acceso por ENLACE MÁGICO enviado por correo (D8): sin contraseñas ni SMS.
   - La librería oficial de Supabase se carga SOLO cuando hace falta (al abrir «Negocio», al volver de un enlace
     o si ya hay una sesión guardada). Los visitantes que solo exploran no la descargan.
   - Flujo «implicit»: el enlace funciona aunque se abra en otro navegador del mismo teléfono.
   - Abuso: espera de 60 s entre envíos en este dispositivo; además Supabase limita los envíos por hora.
     El enlace vence a los 10 minutos y sirve una sola vez (configurado en el proyecto).
   - Iniciar sesión todavía NO publica nada: el formulario guiado y la revisión llegan en T6 y T7. */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var CFG = (window.CERCA_CONFIG || {}).supabase;
  var COOLDOWN_MS = 60000, LAST_KEY = 'nubi.auth.ultimoEnvio', EMAIL_KEY = 'nubi.auth.correo';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) { localStorage.removeItem(k); } else { localStorage.setItem(k, v); } } catch (e) { /* sin almacenamiento */ } }

  var state = { status: CFG ? 'idle' : 'unavailable', email: lsGet(EMAIL_KEY) || '', user: null, message: '' };
  var listeners = [], client = null, loading = null;
  function set(patch) { Object.assign(state, patch); listeners.forEach(function (f) { try { f(state); } catch (e) { /* nada */ } }); render(); }

  /* Error del enlace al volver (#error=…&error_description=…): se lee antes de que la librería limpie la dirección. */
  var linkError = (function () {
    var h = location.hash;
    if (!/^#(error|access_token)=/.test(h) && !/[#&]error=/.test(h)) { return null; }
    var p = new URLSearchParams(h.slice(1));
    if (!p.get('error')) { return null; }
    return p.get('error_code') === 'otp_expired' ? 'El enlace ya venció o ya se usó. Pide uno nuevo.' : 'No se pudo iniciar sesión con ese enlace. Pide uno nuevo.';
  })();
  var returningFromLink = /^#access_token=/.test(location.hash);

  function storageKey() { return CFG ? 'sb-' + CFG.url.replace(/^https:\/\//, '').split('.')[0] + '-auth-token' : ''; }
  function loadLib() {
    if (window.supabase && window.supabase.createClient) { return Promise.resolve(window.supabase); }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CFG.lib; s.integrity = CFG.libIntegrity; s.crossOrigin = 'anonymous'; s.async = true;
      s.onload = function () { resolve(window.supabase); };
      s.onerror = function () { reject(new Error('lib')); };
      document.head.appendChild(s);
    });
  }
  /* Cliente único. Se puede sustituir en pruebas con _useClient(falso). */
  function ready() {
    if (!CFG) { return Promise.reject(new Error('sin configuración')); }
    if (client) { return Promise.resolve(client); }
    if (!loading) {
      set({ status: state.status === 'idle' ? 'loading' : state.status });
      loading = loadLib().then(function (lib) {
        client = lib.createClient(CFG.url, CFG.publishableKey, {
          auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
        });
        wire(client);
        return client;
      }).catch(function (e) {
        loading = null;
        set({ status: 'error', message: navigator.onLine === false ? 'Sin conexión: no se pudo preparar el acceso.' : 'No se pudo cargar el servicio de acceso. Inténtalo de nuevo.' });
        throw e;
      });
    }
    return loading;
  }
  function wire(c) {
    c.auth.onAuthStateChange(function (ev, session) {
      if (session && session.user) {
        var was = state.status;
        set({ status: 'signed_in', user: { id: session.user.id, email: session.user.email }, email: session.user.email, message: '' });
        lsSet(LAST_KEY, null);
        if (was !== 'signed_in' && returningFromLink) { returningFromLink = false; location.hash = '#/mi-negocio'; }
      } else if (ev === 'SIGNED_OUT' || state.status === 'loading' || state.status === 'idle') {
        set({ status: linkError ? 'error' : 'signed_out', user: null, message: linkError || '' });
        linkError = null;
      }
    });
  }

  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254; }
  function waitLeft() { var t = +lsGet(LAST_KEY) || 0; return Math.max(0, COOLDOWN_MS - (Date.now() - t)); }
  function friendly(err) {
    var code = (err && (err.code || err.error_code)) || '', status = err && err.status;
    if (status === 429 || /rate_limit/.test(code)) { return 'Se alcanzó el límite de correos de este entorno de prueba. Inténtalo más tarde.'; }
    if (/email_address_invalid|validation_failed/.test(code)) { return 'Ese correo no parece válido. Revísalo.'; }
    if (/signup_disabled/.test(code)) { return 'El registro de comerciantes no está abierto en este momento.'; }
    if (navigator.onLine === false || (err && /fetch|network/i.test(err.message || ''))) { return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'; }
    return 'No pudimos enviar el enlace. Inténtalo de nuevo en unos minutos.';
  }

  function sendLink(email) {
    email = String(email || '').trim().toLowerCase();
    if (!validEmail(email)) { set({ status: 'signed_out', message: 'Escribe un correo válido, por ejemplo nombre@correo.com.' }); return Promise.resolve(false); }
    var w = waitLeft();
    if (w > 0) { set({ status: 'sent', email: email, message: 'Espera ' + Math.ceil(w / 1000) + ' s antes de pedir otro enlace.' }); return Promise.resolve(false); }
    set({ status: 'sending', email: email, message: '' });
    return ready().then(function (c) {
      return c.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
    }).then(function (r) {
      if (r && r.error) { set({ status: 'signed_out', message: friendly(r.error) }); return false; }
      lsSet(LAST_KEY, String(Date.now())); lsSet(EMAIL_KEY, email);
      set({ status: 'sent', email: email, message: '' });
      return true;
    }, function (e) { if (state.status === 'sending') { set({ status: 'signed_out', message: friendly(e) }); } return false; });
  }
  function signOut() {
    return ready().then(function (c) { return c.auth.signOut(); }).then(function () { set({ status: 'signed_out', user: null, message: 'Cerraste la sesión.' }); });
  }

  /* ---------- Interfaz (tarjeta en «Negocio») ---------- */
  function render() {
    var box = $('#auth-box'), body = $('#auth-body'); if (!box || !body) { return; }
    box.hidden = state.status === 'unavailable';
    var s = state.status, msg = state.message ? '<p class="auth-msg' + (s === 'error' || /no |límite|válido|Sin conexión|Espera/.test(state.message) ? ' is-error' : '') + '" role="alert">' + esc(state.message) + '</p>' : '';
    var note = '<p class="ed-hint">Entorno de prueba: entrar todavía no publica nada. Tu correo solo se usa para iniciar sesión.</p>';
    if (s === 'signed_in') {
      body.innerHTML = '<p>Sesión iniciada como <strong>' + esc(state.user.email) + '</strong>.</p>' + msg +
        '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-auth="out">Cerrar sesión</button></div>' + note;
      return;
    }
    if (s === 'sent') {
      body.innerHTML = '<p>Te enviamos un enlace a <strong>' + esc(state.email) + '</strong>. Ábrelo desde este mismo teléfono o computador. Vence en 10 minutos y sirve una sola vez.</p>' + msg +
        '<p class="ed-hint">¿No llega? Revisa la carpeta de spam. Este entorno de prueba solo envía unos pocos correos por hora.</p>' +
        '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-auth="again">Usar otro correo</button>' +
        '<button type="button" class="btn btn--ghost" data-auth="resend">Reenviar</button></div>';
      return;
    }
    if (s === 'loading' || s === 'idle') { body.innerHTML = '<p class="ed-hint" role="status">Preparando el acceso…</p>'; return; }
    var busy = s === 'sending';
    body.innerHTML = '<p>Entra con tu correo: te enviaremos un enlace. Sin contraseñas.</p>' +
      '<form class="auth-form" id="auth-form" novalidate><label for="auth-email">Correo electrónico</label>' +
      '<input id="auth-email" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="nombre@correo.com" value="' + esc(state.email) + '"' + (busy ? ' disabled' : '') + '>' +
      '<button type="submit" class="btn"' + (busy ? ' disabled aria-busy="true"' : '') + '>' + (busy ? 'Enviando…' : 'Enviarme el enlace') + '</button></form>' + msg + note;
  }
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'auth-form') { e.preventDefault(); sendLink($('#auth-email').value); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-auth]'); if (!b) { return; }
    var a = b.dataset.auth;
    if (a === 'out') { signOut(); }
    if (a === 'again') { set({ status: 'signed_out', message: '' }); var i = $('#auth-email'); if (i) { i.focus(); } }
    if (a === 'resend') { sendLink(state.email); }
  });

  // Se prepara al abrir «Negocio», al volver de un enlace o si ya había una sesión en este dispositivo.
  function maybeStart() {
    if (!CFG) { return; }
    if (/^#\/mi-negocio/.test(location.hash) || returningFromLink || linkError || lsGet(storageKey())) { ready().catch(function () { /* mensaje ya mostrado */ }); }
  }
  window.addEventListener('hashchange', maybeStart);
  if (linkError) { state.message = linkError; history.replaceState(null, '', location.pathname + location.search + '#/mi-negocio'); window.dispatchEvent(new HashChangeEvent('hashchange')); } // que vea el aviso en «Negocio»
  render(); maybeStart();

  Cerca.auth = {
    available: function () { return !!CFG; },
    ready: ready, sendLink: sendLink, signOut: signOut,
    state: function () { return Object.assign({}, state); },
    onChange: function (f) { listeners.push(f); },
    user: function () { return state.user; },
    COOLDOWN_MS: COOLDOWN_MS,
    // Solo para pruebas: sustituye el cliente por uno simulado (no envía correos).
    _useClient: function (fake) { client = fake; loading = Promise.resolve(fake); wire(fake); },
    _reset: function () { client = null; loading = null; lsSet(LAST_KEY, null); set({ status: 'signed_out', user: null, message: '' }); }
  };
})();
