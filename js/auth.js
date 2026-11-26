/* Cuentas de Nubi (Etapa 1, T5 revisada): Supabase Auth, sin servidor propio ni contraseñas caseras.
   - Explorar no requiere cuenta. La cuenta solo hace falta para registrar o administrar negocios.
   - Método principal: Google (OAuth) con flujo PKCE: el código de regreso solo sirve en el navegador que lo pidió.
   - Alternativa secundaria: enlace por correo (limitado por el correo integrado de Supabase hasta tener SMTP propio).
     Correo y contraseña llegará después, con SMTP externo para verificar y recuperar (no se implementa aquí).
   - Sesión: la guarda la librería oficial en este dispositivo y la renueva sola (token corto + renovación). Si la
     renovación falla, se avisa «tu sesión terminó».
   - Comerciantes y administradores usan las mismas cuentas; los permisos los dan miembros_negocio y
     administradores con RLS en la base de datos.
   - La librería se carga solo cuando hace falta (al abrir «Negocio» o «Moderación», al volver del inicio de sesión
     o si ya había una sesión guardada). Ningún secreto vive en el navegador: solo la clave publicable. */
(function () {
  'use strict';
  window.Cerca = window.Cerca || {};
  var CFG = (window.CERCA_CONFIG || {}).supabase;
  var COOLDOWN_MS = 60000, LAST_KEY = 'nubi.auth.ultimoEnvio', EMAIL_KEY = 'nubi.auth.correo', BACK_KEY = 'nubi.auth.volver';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) { localStorage.removeItem(k); } else { localStorage.setItem(k, v); } } catch (e) { /* sin almacenamiento */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v === null) { sessionStorage.removeItem(k); } else { sessionStorage.setItem(k, v); } } catch (e) { /* nada */ } }

  var state = { status: CFG ? 'idle' : 'unavailable', email: lsGet(EMAIL_KEY) || '', user: null, message: '', google: null, showEmail: false };
  var listeners = [], client = null, loading = null, signingOut = false, hadSession = false;
  function set(patch) { Object.assign(state, patch); listeners.forEach(function (f) { try { f(state); } catch (e) { /* nada */ } }); render(); }

  /* ---------- Regreso desde Google o desde el enlace (PKCE: ?code=…; errores en ?error=… o #error=…) ---------- */
  var urlQ = new URLSearchParams(location.search), urlH = new URLSearchParams(location.hash.replace(/^#/, ''));
  var returning = urlQ.has('code') || /^#access_token=/.test(location.hash);
  var linkError = (function () {
    var p = urlQ.get('error') ? urlQ : urlH.get('error') ? urlH : null; if (!p) { return null; }
    var code = p.get('error_code') || '', err = p.get('error'), desc = p.get('error_description') || '';
    if (code === 'otp_expired') { return 'El enlace ya venció o ya se usó. Pide uno nuevo.'; }
    if (err === 'access_denied' && /cancel|denied|user/i.test(desc + code) || code === 'user_cancelled') { return 'Cancelaste el inicio de sesión. Puedes intentarlo de nuevo cuando quieras.'; }
    if (/provider is not enabled|Unsupported provider/i.test(desc)) { return 'El inicio de sesión con Google todavía no está activado.'; }
    return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  })();
  // Limpia la dirección (quita code/error) sin recargar y vuelve a la pantalla de antes.
  function cleanUrl(toHash) {
    var q = new URLSearchParams(location.search);
    ['code', 'state', 'error', 'error_code', 'error_description'].forEach(function (k) { q.delete(k); });
    var qs = q.toString(), h = toHash || (/^#(access_token|error)=/.test(location.hash) ? '#/mi-negocio' : location.hash);
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + h);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  function backHash() { var h = ssGet(BACK_KEY); ssSet(BACK_KEY, null); return h && /^#\/[\w/-]*$/.test(h) ? h : '#/mi-negocio'; }

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
  function ready() {
    if (!CFG) { return Promise.reject(new Error('sin configuración')); }
    if (client) { return Promise.resolve(client); }
    if (!loading) {
      if (state.status === 'idle') { set({ status: returning ? 'returning' : 'loading' }); }
      loading = loadLib().then(function (lib) {
        client = lib.createClient(CFG.url, CFG.publishableKey, {
          auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
        });
        wire(client);
        return client;
      }).catch(function (e) {
        loading = null;
        set({ status: 'error', message: navigator.onLine === false ? 'Sin conexión: no se pudo preparar el acceso. Puedes seguir explorando.' : 'No se pudo cargar el servicio de acceso. Inténtalo de nuevo.' });
        throw e;
      });
    }
    return loading;
  }
  function sessionMethod(session) {
    try {
      var p = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      var m = (p.amr || [])[0]; return m && m.method === 'oauth' ? ((session.user.app_metadata && session.user.app_metadata.providers || []).indexOf('google') !== -1 ? 'google' : 'oauth') : m && m.method ? 'email' : null;
    } catch (e) { return null; }
  }
  function wire(c) {
    c.auth.onAuthStateChange(function (ev, session) {
      if (session && session.user) {
        // Método de ESTA sesión (en el token: amr), no el de la primera vez que se creó la cuenta.
        var was = state.status, u = session.user, prov = sessionMethod(session) || (u.app_metadata && u.app_metadata.provider) || 'email';
        hadSession = true;
        set({ status: 'signed_in', user: { id: u.id, email: u.email, name: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '', provider: prov }, email: u.email || state.email, message: '' });
        lsSet(LAST_KEY, null);
        if (was !== 'signed_in' && returning) { returning = false; cleanUrl(backHash()); }
      } else if (ev === 'SIGNED_OUT') {
        var expired = hadSession && !signingOut; // la renovación falló o se cerró en otra pestaña
        signingOut = false; hadSession = false;
        set({ status: 'signed_out', user: null, message: expired ? 'Tu sesión terminó. Vuelve a entrar para seguir.' : (state.message || '') });
      } else if (state.status === 'loading' || state.status === 'idle' || state.status === 'returning') {
        // Sin sesión: si veníamos de Google/enlace y no hay sesión, el código no sirvió (otro navegador o vencido).
        var msg = linkError || (returning ? 'No se pudo completar el inicio de sesión en este navegador. Inténtalo de nuevo desde aquí.' : '');
        if (returning || linkError) { returning = false; linkError = null; cleanUrl(backHash()); }
        set({ status: msg ? 'error' : 'signed_out', user: null, message: msg });
      }
    });
  }

  /* ¿Google ya está activado en el servidor? (configuración pública de Auth; no envía nada) */
  function checkProviders() {
    if (!CFG || state.google !== null) { return; }
    fetch(CFG.url + '/auth/v1/settings', { headers: { apikey: CFG.publishableKey } }).then(function (r) { return r.json(); })
      .then(function (s) { set({ google: !!(s.external && s.external.google) }); }, function () { set({ google: false }); });
  }

  function friendly(err) {
    var code = (err && (err.code || err.error_code)) || '', status = err && err.status, msg = (err && err.message) || '';
    if (/provider is not enabled|Unsupported provider/i.test(msg) || code === 'validation_failed' && /provider/i.test(msg)) { return 'El inicio de sesión con Google todavía no está activado.'; }
    if (status === 429 || /rate_limit/.test(code)) { return 'Se alcanzó el límite de correos de este entorno de prueba. Usa «Continuar con Google» o inténtalo más tarde.'; }
    if (/email_address_invalid/.test(code)) { return 'Ese correo no parece válido. Revísalo.'; }
    if (/signup_disabled/.test(code)) { return 'El registro de comerciantes no está abierto en este momento.'; }
    if (navigator.onLine === false || /fetch|network/i.test(msg)) { return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'; }
    return 'No se pudo iniciar sesión. Inténtalo de nuevo en unos minutos.';
  }
  function redirectTo() { return location.origin + location.pathname; } // sin ?/#: coincide con las URL permitidas en Supabase

  /* Google: guarda a qué pantalla volver y deja que la librería abra la página de Google. */
  function signInWithGoogle() {
    if (state.google === false) { set({ message: 'El inicio de sesión con Google todavía no está activado.' }); return Promise.resolve(false); }
    ssSet(BACK_KEY, /^#\//.test(location.hash) ? location.hash : '#/mi-negocio');
    set({ status: 'redirecting', message: '' });
    return ready().then(function (c) {
      return c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo(), queryParams: { prompt: 'select_account' } } });
    }).then(function (r) {
      if (r && r.error) { ssSet(BACK_KEY, null); set({ status: 'signed_out', message: friendly(r.error) }); return false; }
      // Si el navegador no salió de la página en unos segundos (bloqueado o cancelado), se puede reintentar.
      setTimeout(function () { if (state.status === 'redirecting' && document.visibilityState === 'visible') { set({ status: 'signed_out', message: 'No se abrió la página de Google. Inténtalo de nuevo.' }); } }, 8000);
      return true;
    }, function (e) { ssSet(BACK_KEY, null); if (state.status === 'redirecting') { set({ status: 'signed_out', message: friendly(e) }); } return false; });
  }

  /* Enlace por correo (alternativa secundaria, limitada hasta tener SMTP propio). */
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254; }
  function waitLeft() { var t = +lsGet(LAST_KEY) || 0; return Math.max(0, COOLDOWN_MS - (Date.now() - t)); }
  function sendLink(email) {
    email = String(email || '').trim().toLowerCase();
    if (!validEmail(email)) { set({ status: 'signed_out', showEmail: true, message: 'Escribe un correo válido, por ejemplo nombre@correo.com.' }); return Promise.resolve(false); }
    var w = waitLeft();
    if (w > 0) { set({ status: 'sent', email: email, message: 'Espera ' + Math.ceil(w / 1000) + ' s antes de pedir otro enlace.' }); return Promise.resolve(false); }
    ssSet(BACK_KEY, /^#\//.test(location.hash) ? location.hash : '#/mi-negocio');
    set({ status: 'sending', email: email, message: '' });
    return ready().then(function (c) {
      return c.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: redirectTo() } });
    }).then(function (r) {
      if (r && r.error) { set({ status: 'signed_out', showEmail: true, message: friendly(r.error) }); return false; }
      lsSet(LAST_KEY, String(Date.now())); lsSet(EMAIL_KEY, email);
      set({ status: 'sent', email: email, message: '' });
      return true;
    }, function (e) { if (state.status === 'sending') { set({ status: 'signed_out', showEmail: true, message: friendly(e) }); } return false; });
  }
  function signOut() {
    signingOut = true;
    return ready().then(function (c) { return c.auth.signOut(); }).then(function () { set({ status: 'signed_out', user: null, message: 'Cerraste la sesión.' }); });
  }

  /* ---------- Interfaz (tarjeta en «Negocio») ---------- */
  var G_LOGO = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
  function render() {
    var box = $('#auth-box'), body = $('#auth-body'); if (!box || !body) { return; }
    box.hidden = state.status === 'unavailable';
    var s = state.status, isErr = s === 'error' || /no |límite|válido|Sin conexión|Espera|terminó|Cancelaste|todavía/.test(state.message);
    var msg = state.message ? '<p class="auth-msg' + (isErr ? ' is-error' : '') + '" role="alert">' + esc(state.message) + '</p>' : '';
    var note = '<p class="ed-hint">Para explorar Nubi no necesitas cuenta. Entrar solo hace falta para registrar o administrar un negocio. Entorno de prueba: entrar no publica nada.</p>' +
      '<p class="ed-hint">Al entrar con Google recibimos tu correo, nombre y foto de perfil para identificarte. <a href="#/privacidad">Aviso de privacidad y términos</a>.</p>';
    if (s === 'signed_in') {
      var u = state.user, via = u.provider === 'google' ? ' con Google' : '';
      body.innerHTML = '<p>Sesión iniciada' + via + ' como <strong>' + esc(u.name ? u.name + ' (' + u.email + ')' : u.email) + '</strong>.</p>' + msg +
        '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-auth="out">Cerrar sesión</button></div>' +
        '<p class="ed-hint">Tu sesión queda guardada en este dispositivo y se renueva sola. Ciérrala si el teléfono es compartido.</p>';
      return;
    }
    if (s === 'returning') { body.innerHTML = '<p class="ed-hint" role="status">Completando el inicio de sesión…</p>'; return; }
    if (s === 'redirecting') { body.innerHTML = '<p class="ed-hint" role="status">Abriendo Google… Si no pasa nada, revisa que el navegador permita abrir la página.</p>'; return; }
    if (s === 'sent') {
      body.innerHTML = '<p>Te enviamos un enlace a <strong>' + esc(state.email) + '</strong>. Ábrelo en este mismo navegador. Vence en 10 minutos y sirve una sola vez.</p>' + msg +
        '<p class="ed-hint">¿No llega? Revisa el spam. El entorno de prueba envía muy pocos correos por hora: si puedes, usa «Continuar con Google».</p>' +
        '<div class="auth-acts"><button type="button" class="btn btn--ghost" data-auth="again">Volver</button><button type="button" class="btn btn--ghost" data-auth="resend">Reenviar</button></div>';
      return;
    }
    if (s === 'loading' || s === 'idle') { body.innerHTML = '<p class="ed-hint" role="status">Preparando el acceso…</p>'; return; }
    var gOff = state.google === false, busy = s === 'sending';
    body.innerHTML = '<p>Entra para registrar tu negocio o administrarlo. Sin contraseñas.</p>' +
      '<button type="button" class="btn auth-google" data-auth="google"' + (gOff ? ' aria-disabled="true"' : '') + '>' + G_LOGO + '<span>Continuar con Google</span></button>' +
      (gOff ? '<p class="ed-hint">El acceso con Google se está activando. Mientras tanto puedes entrar con un enlace por correo.</p>' : '') + msg +
      '<details class="auth-alt"' + (state.showEmail || gOff ? ' open' : '') + '><summary>Entrar con un enlace por correo</summary>' +
      '<form class="auth-form" id="auth-form" novalidate><label for="auth-email">Correo electrónico</label>' +
      '<input id="auth-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="254" placeholder="nombre@correo.com" value="' + esc(state.email) + '"' + (busy ? ' disabled' : '') + '>' +
      '<button type="submit" class="btn btn--ghost"' + (busy ? ' disabled aria-busy="true"' : '') + '>' + (busy ? 'Enviando…' : 'Enviarme el enlace') + '</button></form>' +
      '<p class="ed-hint">Opción limitada en el entorno de prueba (pocos correos por hora).</p></details>' + note;
  }
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'auth-form') { e.preventDefault(); sendLink($('#auth-email').value); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-auth]'); if (!b) { return; }
    var a = b.dataset.auth;
    if (a === 'google') { signInWithGoogle(); }
    if (a === 'out') { signOut(); }
    if (a === 'again') { set({ status: 'signed_out', message: '', showEmail: true }); }
    if (a === 'resend') { sendLink(state.email); }
  });
  document.addEventListener('toggle', function (e) { if (e.target && e.target.classList && e.target.classList.contains('auth-alt')) { state.showEmail = e.target.open; } }, true);

  // Se prepara al abrir «Negocio» o «Moderación», al volver del inicio de sesión o si ya había una sesión aquí.
  function maybeStart() {
    if (!CFG) { return; }
    if (/^#\/(mi-negocio|admin)/.test(location.hash)) { checkProviders(); }
    if (/^#\/(mi-negocio|admin)/.test(location.hash) || returning || linkError || lsGet(storageKey())) { ready().catch(function () { /* mensaje ya mostrado */ }); }
  }
  window.addEventListener('hashchange', maybeStart);
  // Si el usuario vuelve atrás desde Google sin terminar, la página se restaura del caché: se reactiva el botón.
  window.addEventListener('pageshow', function (e) { if (e.persisted && state.status === 'redirecting') { set({ status: 'signed_out', message: 'Cancelaste el inicio de sesión. Puedes intentarlo de nuevo.' }); } });
  if (linkError && !returning) { state.message = linkError; state.status = 'error'; cleanUrl(backHash()); }
  render(); maybeStart();

  Cerca.auth = {
    available: function () { return !!CFG; },
    ready: ready, signInWithGoogle: signInWithGoogle, sendLink: sendLink, signOut: signOut,
    state: function () { return Object.assign({}, state); },
    onChange: function (f) { listeners.push(f); },
    user: function () { return state.user; },
    redirectTo: redirectTo,
    COOLDOWN_MS: COOLDOWN_MS,
    // Solo para pruebas: sustituye el cliente por uno simulado (no abre Google ni envía correos).
    _useClient: function (fake) { client = fake; loading = Promise.resolve(fake); wire(fake); },
    _reset: function () { client = null; loading = null; hadSession = false; signingOut = false; lsSet(LAST_KEY, null); set({ status: 'signed_out', user: null, message: '', showEmail: false }); },
    _setGoogle: function (v) { set({ google: v }); }
  };
})();
