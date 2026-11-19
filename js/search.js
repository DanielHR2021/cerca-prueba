/* Búsqueda tolerante a errores, sin dependencias ni servicios externos.
   Tolera: tildes y mayúsculas, letras cambiadas, faltantes o repetidas, letras que suenan igual
   en español (b/v, c/s/z, ll/y, h muda, qu/k) y palabras a medio escribir.
   Entiende frases naturales: ignora palabras de relleno («dónde puedo…»). */
(function () {
  window.Cerca = window.Cerca || {};
  var STOP = new Set(('a al algo aqui ayuda busco buscar con cerca comprar de del donde el en encontrar es esta estoy hay la las lo los me mi ' +
    'necesito o para por puedo que quiero se si su sus un una unas unos y').split(' '));

  function strip(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function words(s) { return strip(s).split(/[^a-z0-9]+/).filter(Boolean); }

  // Clave aproximada de pronunciación en español: palabras que suenan igual quedan iguales.
  function phon(w) {
    return w.replace(/ch/g, '8').replace(/h/g, '')
      .replace(/gu(?=[ei])/g, 'G').replace(/g(?=[ei])/g, 'j').replace(/G/g, 'g')
      .replace(/qu/g, 'k').replace(/q/g, 'k')
      .replace(/c(?=[ei])/g, 's').replace(/c/g, 'k')
      .replace(/v/g, 'b').replace(/z/g, 's').replace(/ll/g, 'y').replace(/w/g, 'u')
      .replace(/(.)\1+/g, '$1');
  }

  // Distancia de edición con intercambio de letras vecinas (a↔b cuenta como 1 error).
  function dist(a, b) {
    var la = a.length, lb = b.length, i, j, d = [];
    for (i = 0; i <= la; i++) { d[i] = [i]; }
    for (j = 1; j <= lb; j++) { d[0][j] = j; }
    for (i = 1; i <= la; i++) {
      for (j = 1; j <= lb; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) { d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); }
      }
    }
    return d[la][lb];
  }

  // Qué tan bien coincide un término con una palabra: 0 es exacto; más alto es más aproximado; null no coincide.
  function score(t, w) {
    if (w === t) { return 0; }
    if (t.length === 1) { return w.indexOf(t) === 0 ? 0.3 : null; }  // primera letra recién escrita
    if (w.indexOf(t) === 0) { return 0.2; }          // palabra a medio escribir
    if (t.length >= 3 && w.indexOf(t) > 0) { return 0.6; }
    var allowed = t.length <= 3 ? 0 : t.length <= 6 ? 1 : 2;
    if (!allowed) { return null; }
    var d = dist(t, w), dp = dist(t, w.slice(0, t.length));
    if (d <= allowed) { return 1 + d; }
    if (dp <= allowed) { return 1.4 + dp; }          // error dentro de una palabra a medio escribir
    return null;
  }

  var cache = {};
  function index(b) {
    if (!cache[b.id]) { cache[b.id] = words([b.name, b.blurb, b.category, b.keywords.join(' ')].join(' ')).map(phon); }
    return cache[b.id];
  }

  /* rank(negocios, texto) -> { items, approximate }
     - Sin texto útil devuelve todos en su orden.
     - Con texto, devuelve los que coinciden con al menos un término, los mejores primero. */
  function rank(items, query) {
    var tokens = words(query).filter(function (t) { return !STOP.has(t); }).map(function (t) { return t.length === 1 ? t : (phon(t).length < 2 ? phon(t) + '#' : phon(t))  /* «zzzz» queda en «s»: el '#' evita que coincida con todo */; });
    if (!tokens.length) { return { items: items.slice(), approximate: false }; }
    var scored = [];
    items.forEach(function (b, pos) {
      var ws = index(b), matched = 0, total = 0, approx = false;
      tokens.forEach(function (t) {
        var best = null;
        ws.forEach(function (w) { var s = score(t, w); if (s !== null && (best === null || s < best)) { best = s; } });
        if (best !== null) { matched++; total += best; if (best >= 1) { approx = true; } }
      });
      if (matched) { scored.push({ b: b, matched: matched, total: total, approx: approx, pos: pos }); }
    });
    scored.sort(function (x, y) { return (y.matched - x.matched) || (x.total - y.total) || (x.pos - y.pos); });
    return { items: scored.map(function (s) { return s.b; }), approximate: scored.some(function (s) { return s.approx; }) };
  }

  Cerca.search = { rank: rank, phon: phon, dist: dist, words: words };
})();
