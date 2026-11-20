/* Editor de perfil para comerciantes (DEMOSTRACIÓN LOCAL).
   - El borrador (textos, colores, icono, destacados y un logotipo pequeño) se guarda en este dispositivo.
   - Portada y galería solo duran esta visita: no se guardan, para no llenar el almacenamiento del navegador.
   - Las fotos se reducen en el propio dispositivo; no se suben a ningún servidor. Nada se publica. */
(function () {
  'use strict';
  var P = Cerca.profiles, K = P.KINDS, F = P.FAMILIES, KEY = 'cerca.draft', MAX_ITEMS = 4, MAX_GALLERY = 4;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var mem = { cover: null, gallery: [] };

  function defaults() { return { name: '', kind: 'panaderia', blurb: '', from: 7, to: 19, palette: 'trigo', icon: 'bread', story: '', news: '', items: [{ n: '', d: '', p: '', i: 'bread' }], logo: null }; }
  function load() {
    try { var x = JSON.parse(localStorage.getItem(KEY)); return x && typeof x === 'object' ? Object.assign(defaults(), x) : null; } catch (e) { return null; }
  }
  var d = load() || defaults();
  if (!K[d.kind]) { d.kind = 'panaderia'; }

  function fam() { return F[K[d.kind].family]; }
  function status(t) { $('#ed-status').textContent = t; }
  function now() { return new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }); }
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(d)); status('Borrador guardado en este dispositivo (' + now() + ')'); }
      catch (e) {
        try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, d, { logo: null }))); status('Guardado sin el logotipo: no cabe en el almacenamiento de este navegador.'); }
        catch (e2) { status('Este navegador no permite guardar el borrador. Los cambios duran solo esta visita.'); }
      }
    }, 350);
  }

  /* Negocio que ve la vista previa (mismo formato que los negocios de la app). */
  function draft() {
    var k = K[d.kind];
    return {
      id: 'draft', draft: true, demo: false, name: d.name.trim() || 'Nombre de tu negocio', kind: d.kind, kindLabel: k.label, category: k.category,
      palette: d.palette, icon: d.icon, blurb: d.blurb.trim() || 'Una frase corta sobre lo que ofreces.', story: d.story.trim(),
      news: d.news.trim() ? { when: 'Hoy', text: d.news.trim() } : null,
      products: d.items.filter(function (i) { return i.n.trim(); }).map(function (i) { return { n: i.n.trim(), d: i.d.trim(), p: i.p.trim(), i: i.i }; }),
      hours: { from: +d.from, to: +d.to }, moved: false, fresh: true, tags: [], logo: d.logo, cover: mem.cover, gallery: mem.gallery.slice()
    };
  }

  /* ---------- Formulario ---------- */
  function fmtHour(h) { return (h % 12 === 0 ? 12 : h % 12) + ':00 ' + (h >= 12 ? 'p. m.' : 'a. m.'); }
  function fillStatic() {
    $('#ed-kind').innerHTML = Object.keys(K).map(function (k) { return '<option value="' + k + '">' + esc(K[k].label) + '</option>'; }).join('');
    var hours = ''; for (var h = 0; h < 24; h++) { hours += '<option value="' + h + '">' + fmtHour(h) + '</option>'; }
    $('#ed-from').innerHTML = hours; $('#ed-to').innerHTML = hours;
  }
  function renderIdentity() {
    var f = fam();
    if (f.palettes.indexOf(d.palette) === -1) { d.palette = f.palettes[0]; }
    if (f.icons.indexOf(d.icon) === -1) { d.icon = K[d.kind].icon; }
    var dark = document.documentElement.dataset.theme === 'dark';
    $('#ed-palettes').innerHTML = f.palettes.map(function (id) {
      var p = P.PALETTES[id], v = dark ? p.d : p.l;
      return '<li class="ed-swatch"><input type="radio" name="ed-palette" value="' + id + '" id="pal-' + id + '"' + (id === d.palette ? ' checked' : '') + '>' +
        '<span><i style="--sw-c:' + v[0] + ';--sw-a:' + v[4] + '" aria-hidden="true"></i>' + esc(p.label) + '</span></li>';
    }).join('');
    $('#ed-icons').innerHTML = f.icons.map(function (id) {
      return '<li class="ed-iconopt"><input type="radio" name="ed-icon" value="' + id + '" aria-label="' + esc(P.ICON_NAMES[id] || id) + '"' + (id === d.icon ? ' checked' : '') + '><span>' + P.icon(id, 24) + '</span></li>';
    }).join('');
    $('#ed-family').textContent = 'Estilo: ' + f.label.toLowerCase() + '. Los colores ya tienen buen contraste en modo claro y oscuro.';
  }
  function renderItems() {
    var f = fam();
    $('#ed-items').innerHTML = d.items.map(function (it, n) {
      if (f.icons.indexOf(it.i) === -1) { it.i = f.icons[0]; }
      return '<li class="ed-item" data-i="' + n + '">' +
        '<select data-f="i" aria-label="Icono del destacado ' + (n + 1) + '">' + f.icons.map(function (id) { return '<option value="' + id + '"' + (id === it.i ? ' selected' : '') + '>' + esc(P.ICON_NAMES[id] || id) + '</option>'; }).join('') + '</select>' +
        '<input data-f="n" maxlength="40" autocomplete="off" value="' + esc(it.n) + '" placeholder="Nombre (ej.: Pan de bono)" aria-label="Nombre del destacado ' + (n + 1) + '">' +
        '<div class="ed-row"><input data-f="d" maxlength="50" autocomplete="off" value="' + esc(it.d) + '" placeholder="Detalle" aria-label="Detalle del destacado ' + (n + 1) + '">' +
        '<input data-f="p" maxlength="20" autocomplete="off" value="' + esc(it.p) + '" placeholder="Precio" aria-label="Precio del destacado ' + (n + 1) + '"></div>' +
        '<button type="button" class="ed-item-del" data-del="' + n + '">Quitar</button></li>';
    }).join('');
    $('#ed-add-item').hidden = d.items.length >= MAX_ITEMS;
  }
  function renderImages() {
    $('#ed-logo-prev').innerHTML = d.logo ? '<img src="' + d.logo + '" alt="Logotipo elegido"><button type="button" class="btn btn--ghost" id="ed-logo-del">Quitar logotipo</button>' : '';
    $('#ed-cover-prev').innerHTML = mem.cover ? '<img src="' + mem.cover + '" alt="Portada elegida"><button type="button" class="btn btn--ghost" id="ed-cover-del">Quitar portada</button>' : '';
    $('#ed-gallery-prev').innerHTML = mem.gallery.map(function (src, n) { return '<li><img src="' + src + '" alt="Foto ' + (n + 1) + '"><button type="button" data-gal-del="' + n + '" aria-label="Quitar foto ' + (n + 1) + '">×</button></li>'; }).join('');
    $('#ed-gallery').disabled = mem.gallery.length >= MAX_GALLERY;
  }
  function fillForm() {
    $('#ed-name').value = d.name; $('#ed-kind').value = d.kind; $('#ed-blurb').value = d.blurb; $('#ed-story').value = d.story; $('#ed-news').value = d.news;
    $('#ed-from').value = String(d.from); $('#ed-to').value = String(d.to);
    renderIdentity(); renderItems(); renderImages(); checkHours();
  }
  function checkHours() { var bad = +d.to <= +d.from; $('#ed-hours-err').hidden = !bad; }

  function refresh() {
    if (!window.Cerca.app) { return; }
    $('#ed-preview').innerHTML = '<p class="ed-preview-label">Vista previa: solo tú la ves, en este dispositivo</p>' + P.render(draft(), Cerca.app.profileHelpers(true));
  }
  function changed() { save(); refresh(); }

  /* ---------- Imágenes: se reducen en el dispositivo ---------- */
  function readImage(file, max, type, q, square) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Elige una imagen (JPG, PNG o WebP).')); return; }
      if (file.size > 15 * 1024 * 1024) { reject(new Error('La imagen pesa más de 15 MB. Elige una más liviana.')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
        if (square) { var m = Math.min(w, h); sx = (w - m) / 2; sy = (h - m) / 2; sw = sh = m; }
        var s = Math.min(1, max / Math.max(sw, sh)), c = document.createElement('canvas');
        c.width = Math.round(sw * s); c.height = Math.round(sh * s);
        c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL(type, q));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('No se pudo leer esa imagen.')); };
      img.src = url;
    });
  }
  function onFile(input, fn) {
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []); input.value = '';
      if (!files.length) { return; }
      status('Procesando imagen en tu dispositivo…');
      fn(files).then(function () { renderImages(); changed(); }).catch(function (e) { status(e.message); });
    });
  }

  /* ---------- Eventos ---------- */
  function bind() {
    var form = $('#ed-form');
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.addEventListener('input', function (e) {
      var t = e.target, id = t.id;
      if (id === 'ed-name') { d.name = t.value; } else if (id === 'ed-blurb') { d.blurb = t.value; } else if (id === 'ed-story') { d.story = t.value; }
      else if (id === 'ed-news') { d.news = t.value; } else if (id === 'ed-from') { d.from = +t.value; checkHours(); } else if (id === 'ed-to') { d.to = +t.value; checkHours(); }
      else if (id === 'ed-kind') { d.kind = t.value; renderIdentity(); renderItems(); }
      else if (t.name === 'ed-palette') { d.palette = t.value; } else if (t.name === 'ed-icon') { d.icon = t.value; }
      else if (t.dataset.f) { var li = t.closest('[data-i]'); d.items[+li.dataset.i][t.dataset.f] = t.value; }
      else { return; }
      changed();
    });
    form.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-del]')) { d.items.splice(+t.closest('[data-del]').dataset.del, 1); if (!d.items.length) { d.items.push({ n: '', d: '', p: '', i: fam().icons[0] }); } renderItems(); changed(); }
      else if (t.id === 'ed-add-item') { d.items.push({ n: '', d: '', p: '', i: fam().icons[0] }); renderItems(); var ins = $('#ed-items').querySelectorAll('input[data-f="n"]'); ins[ins.length - 1].focus(); }
      else if (t.id === 'ed-logo-del') { d.logo = null; renderImages(); changed(); }
      else if (t.id === 'ed-cover-del') { mem.cover = null; renderImages(); changed(); }
      else if (t.closest('[data-gal-del]')) { mem.gallery.splice(+t.closest('[data-gal-del]').dataset.galDel, 1); renderImages(); changed(); }
    });
    onFile($('#ed-logo'), function (fs) { return readImage(fs[0], 192, 'image/webp', 0.85, true).then(function (u) { d.logo = u; }); });
    onFile($('#ed-cover'), function (fs) { return readImage(fs[0], 1400, 'image/jpeg', 0.75).then(function (u) { mem.cover = u; }); });
    onFile($('#ed-gallery'), function (fs) {
      return fs.slice(0, MAX_GALLERY - mem.gallery.length).reduce(function (p, f) { return p.then(function () { return readImage(f, 900, 'image/jpeg', 0.72).then(function (u) { mem.gallery.push(u); }); }); }, Promise.resolve());
    });
    $('#ed-clear').addEventListener('click', function () {
      if (!window.confirm('¿Borrar el borrador de tu perfil en este dispositivo?')) { return; }
      try { localStorage.removeItem(KEY); } catch (e) { /* nada */ }
      d = defaults(); mem = { cover: null, gallery: [] }; fillForm(); refresh(); status('Borrador borrado.');
    });
    $('#ed-tab-edit').addEventListener('click', function () { setPane('edit'); });
    $('#ed-tab-prev').addEventListener('click', function () { setPane('preview'); });
    new MutationObserver(function () { renderIdentity(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  function setPane(p) {
    $('#editor').dataset.pane = p;
    $('#ed-tab-edit').setAttribute('aria-pressed', p === 'edit'); $('#ed-tab-prev').setAttribute('aria-pressed', p === 'preview');
  }

  fillStatic(); fillForm(); bind();
  status(load() ? 'Tienes un borrador guardado en este dispositivo.' : 'Empieza a escribir: el borrador se guarda solo en este dispositivo.');
  Cerca.editor = { draft: draft, refresh: refresh, setPane: setPane };
})();
