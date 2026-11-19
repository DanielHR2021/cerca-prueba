/* Mascota provisional, concepto "Encaje": un cuadrado suave al que le falta una esquina y un punto pequeño
   que encaja en ese hueco. Personaje original, abstracto, no animal. Un solo SVG con estados (data-mood);
   las animaciones son CSS de un solo disparo (css/mascot.css).
   Estados: neutral, happy, curious (search), surprised, thinking, empty, celebrate;
   alias de la aplicación: welcome y help (= happy), discover (= happy con salto). */
(function () {
  window.Cerca = window.Cerca || {};
  var f = function (n) { return Math.round(n * 10) / 10; };

  /* Cara reutilizable: ojos y boca de todos los estados, centrada en (cx, cy). */
  Cerca.mascotFace = function (cx, cy) {
    var lx = cx - 12, rx = cx + 12, ey = cy - 4, my = cy + 13;
    function open(x, rxx, ryy) { return '<ellipse class="m-ink" cx="' + x + '" cy="' + ey + '" rx="' + rxx + '" ry="' + ryy + '"/><circle class="m-hi" cx="' + f(x + 1.6) + '" cy="' + f(ey - 2.4) + '" r="1.7"/>'; }
    function arc(x) { return '<path d="M' + (x - 6) + ' ' + (ey + 3) + ' Q' + x + ' ' + (ey - 7) + ' ' + (x + 6) + ' ' + (ey + 3) + '"/>'; }
    return '<g class="m-face">' +
      '<g class="m-gaze">' +
        '<g class="eyes-open">' + open(lx, 5, 6.6) + open(rx, 5, 6.6) + '</g>' +
        '<g class="eyes-wide">' + open(lx, 6, 8.2) + open(rx, 6, 8.2) + '</g>' +
        '<g class="eyes-soft"><g transform="rotate(-8 ' + lx + ' ' + ey + ')">' + open(lx, 5, 6) + '</g><g transform="rotate(8 ' + rx + ' ' + ey + ')">' + open(rx, 5, 6) + '</g></g>' +
      '</g>' +
      '<g class="eyes-happy m-stroke">' + arc(lx) + arc(rx) + '</g>' +
      '<g class="m-mouth m-stroke">' +
        '<path class="mo-smile" d="M' + (cx - 8) + ' ' + my + ' Q' + cx + ' ' + (my + 7) + ' ' + (cx + 8) + ' ' + my + '"/>' +
        '<path class="mo-curious" d="M' + (cx - 6) + ' ' + (my + 2) + ' Q' + (cx + 1) + ' ' + (my + 7) + ' ' + (cx + 8) + ' ' + (my - 1) + '"/>' +
        '<path class="mo-grin m-fill" d="M' + (cx - 10) + ' ' + (my - 1) + ' Q' + cx + ' ' + (my + 14) + ' ' + (cx + 10) + ' ' + (my - 1) + ' Z"/>' +
        '<ellipse class="mo-o m-fill" cx="' + cx + '" cy="' + (my + 4) + '" rx="3.4" ry="4.2"/>' +
        '<path class="mo-flat" d="M' + (cx - 6) + ' ' + (my + 2) + ' L' + (cx + 6) + ' ' + my + '"/>' +
        '<path class="mo-soft" d="M' + (cx - 7) + ' ' + (my + 4) + ' Q' + cx + ' ' + (my + 1) + ' ' + (cx + 7) + ' ' + (my + 4) + '"/>' +
      '</g></g>';
  };

  /* Envoltorio común de los conceptos: shape = elementos de la silueta (clase m-shape). */
  Cerca.mascotWrap = function (inner, label, opts) {
    opts = opts || {};
    return '<svg class="mascot-svg' + (opts.dark ? ' on-dark' : '') + '" data-mood="' + (opts.mood || 'neutral') + '" viewBox="0 0 120 120" role="img" aria-label="' + (label || 'Ayudante de la plataforma') + '" focusable="false">' +
      (opts.defs ? '<defs>' + opts.defs + '</defs>' : '') +
      '<ellipse class="m-shadow" cx="60" cy="114" rx="30" ry="4"/>' + inner + '</svg>';
  };

  /* Concepto elegido: Encaje. uid evita ids duplicados si hay varias mascotas en la página. */
  Cerca.mascotSvg = function (uid, opts) {
    var mask = 'encaje-mask-' + uid;
    return Cerca.mascotWrap(
      '<g class="m-body">' +
        '<rect class="m-shape" x="14" y="22" width="92" height="88" rx="30" mask="url(#' + mask + ')"/>' +
        Cerca.mascotFace(55, 68) +
        '<g class="m-dotg"><circle class="m-dot" cx="95" cy="29" r="9"/></g>' +
      '</g>',
      'Ayudante de la plataforma', Object.assign({ defs: '<mask id="' + mask + '"><rect width="120" height="120" fill="#fff"/><circle cx="101" cy="23" r="21" fill="#000"/></mask>' }, opts));
  };

  var HIDE_KEY = 'cerca.helper.hidden', SEEN_KEY = 'cerca.welcome.seen';
  function store(kind, k, v) {
    try { var s = kind === 'session' ? sessionStorage : localStorage; if (v === undefined) { return s.getItem(k); } s.setItem(k, v); } catch (e) { return null; }
  }

  /* opts: { mount, showBtn, welcomeMs, tips:[...] } */
  Cerca.createMascot = function (o) {
    var mount = o.mount, tips = o.tips || [];
    mount.innerHTML =
      '<div class="helper-bubble" id="helper-bubble" role="status" aria-live="polite" hidden></div>' +
      '<button class="helper-btn" type="button" id="helper-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="helper-help" aria-label="Ayudante: abrir consejos">' + Cerca.mascotSvg('main') + '</button>' +
      '<div class="helper-help" id="helper-help" role="dialog" aria-labelledby="helper-help-title" hidden>' +
        '<h2 id="helper-help-title">Cómo usar la plataforma</h2><ul>' + tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
        '<div class="helper-actions"><button type="button" class="btn" id="helper-close">Entendido</button><button type="button" class="btn btn--ghost" id="helper-hide">Ocultar ayudante</button></div>' +
      '</div>';
    var btn = mount.querySelector('#helper-btn'), svg = mount.querySelector('svg'), bubble = mount.querySelector('#helper-bubble'), help = mount.querySelector('#helper-help');
    var bubbleTimer = null, moodTimer = null, discovered = false;

    function setMood(m) { // reinicia el atributo para que la animación se repita
      svg.removeAttribute('data-mood'); void svg.getBoundingClientRect(); svg.setAttribute('data-mood', m);
      if (m !== 'search' && m !== 'curious') { svg.style.removeProperty('--gx'); svg.style.removeProperty('--gy'); }
    }
    function aim(target) { // la mirada se orienta hacia un elemento (p. ej. el buscador), máximo 3.4 unidades
      if (!target) { return; }
      var a = svg.getBoundingClientRect(), b = target.getBoundingClientRect();
      var dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      svg.style.setProperty('--gx', f(dx / len * 3.4)); svg.style.setProperty('--gy', f(dy / len * 3.4));
    }
    function hideBubble() { bubble.hidden = true; clearTimeout(bubbleTimer); }
    function say(text, ms) {
      bubble.textContent = text; bubble.hidden = false;
      clearTimeout(bubbleTimer);
      if (ms) { bubbleTimer = setTimeout(hideBubble, ms); }
    }
    function settle(ms) { clearTimeout(moodTimer); moodTimer = setTimeout(function () { if (help.hidden) { setMood('neutral'); } }, ms); }
    function openHelp() { help.hidden = false; btn.setAttribute('aria-expanded', 'true'); hideBubble(); setMood('help'); mount.querySelector('#helper-close').focus(); }
    function closeHelp(restoreFocus) { help.hidden = true; btn.setAttribute('aria-expanded', 'false'); setMood('neutral'); if (restoreFocus) { btn.focus(); } }
    function setHidden(h) {
      mount.hidden = h; if (o.showBtn) { o.showBtn.hidden = !h; }
      store('local', HIDE_KEY, h ? '1' : '0');
      if (h) { hideBubble(); help.hidden = true; }
    }

    function poke() { svg.classList.remove('is-poked'); void svg.getBoundingClientRect(); svg.classList.add('is-poked'); }
    svg.addEventListener('animationend', function (e) { if (e.animationName === 'm-squish') { svg.classList.remove('is-poked'); } });
    btn.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.m-dotg')) { setMood('celebrate'); settle(1600); return; } // el punto es un huevo de pascua: salta sin abrir la ayuda
      poke(); help.hidden ? openHelp() : closeHelp(true);
    });
    mount.querySelector('#helper-close').addEventListener('click', function () { closeHelp(true); });
    mount.querySelector('#helper-hide').addEventListener('click', function () { closeHelp(false); setHidden(true); if (o.showBtn) { o.showBtn.focus(); } });
    bubble.addEventListener('click', hideBubble);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !help.hidden) { closeHelp(true); } });
    if (o.showBtn) { o.showBtn.addEventListener('click', function () { setHidden(false); btn.focus(); }); }

    var api = {
      mood: function (m) { if (!mount.hidden) { setMood(m); } },
      searching: function (target) { if (!mount.hidden) { setMood('search'); aim(target); } },
      think: function () { if (!mount.hidden) { setMood('thinking'); settle(1800); } },
      celebrate: function () { if (!mount.hidden) { setMood('celebrate'); settle(1800); } },
      calm: function () { if (!mount.hidden && help.hidden) { setMood('neutral'); } },
      empty: function (text) { if (mount.hidden) { return; } setMood('empty'); say(text, 7000); },
      discover: function (text) { // reacciona siempre con la cara; el mensaje solo la primera vez
        if (mount.hidden) { return; }
        setMood('discover'); settle(1800);
        if (!discovered && text) { discovered = true; say(text, 4500); }
      },
      welcome: function () {
        if (mount.hidden || store('session', SEEN_KEY)) { return; }
        store('session', SEEN_KEY, '1');
        setTimeout(function () {
          setMood('welcome'); say('Hola, soy tu ayudante. Busca lo que necesitas o toca una categoría.', o.welcomeMs);
          settle(o.welcomeMs);
        }, 400);
      },
      isHidden: function () { return mount.hidden; }
    };
    setHidden(store('local', HIDE_KEY) === '1');
    return api;
  };
})();
