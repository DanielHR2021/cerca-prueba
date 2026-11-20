/* Búsqueda por relevancia, sin dependencias ni servicios externos. La usan el buscador y Encaje.
   Campos con peso: nombre, productos/servicios y etiquetas, categoría y tipo de negocio (fuertes);
   frase corta y descripción (débiles).
   Señal principal: coincidencia exacta normalizada (tildes, mayúsculas, plural/singular) o fonética
   (b/v, c/s/z, ll/y, h muda, qu/k). La tolerancia a errores es controlada: nada en palabras de 4 letras
   o menos, 1 error hasta 7 letras, 2 desde 8; solo en campos fuertes y con la misma letra inicial.
   «Empieza por» (palabra a medio escribir) es una señal débil: solo cuenta si ningún negocio tiene una
   coincidencia fuerte. Así «pan» encuentra panaderías y no «pantallas» de un taller de celulares. */
(function () {
  window.Cerca = window.Cerca || {};
  var STOP = new Set(('a al algo algun alguna aqui ayuda busco buscar con cerca comprar de del donde el en encontrar es esta estoy hay la las lo los me mi ' +
    'necesito o para por puedo que quiero se si su sus tienen un una unas unos venden y').split(' '));
  /* Sinónimos mínimos y explícitos (verbo → lo que se busca). Valen como coincidencia fuerte pero no exacta. */
  var SYN = {
    arreglar: ['reparacion', 'reparar'], arreglo: ['reparacion'], reparar: ['reparacion'], componer: ['reparacion'],
    comer: ['comida', 'almuerzo', 'restaurante'], almorzar: ['almuerzo'], desayunar: ['desayuno'], tomar: ['cafe', 'jugo'],
    remedio: ['medicamento', 'farmacia'], medicina: ['medicamento', 'farmacia'], droga: ['medicamento'],
    cortar: ['corte'], motilar: ['corte', 'barberia'], imprimir: ['impresion'], fotocopia: ['copias'], tinto: ['cafe']
  };
  var FIELDS = [['name', 3], ['tags', 3], ['cat', 2.5], ['text', 1]];

  function strip(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function words(s) { return strip(s).split(/[^a-z0-9ñ]+/).filter(Boolean); }
  function stem(w) { return w.length > 4 && /es$/.test(w) ? w.slice(0, -2) : (w.length > 3 && /s$/.test(w) ? w.slice(0, -1) : w); }

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
  function form(raw, orig) { var st = stem(raw); return { raw: raw, st: st, ph: phon(st), orig: orig || raw }; }
  function forms(text) {
    var out = [];
    String(text || '').split(/[\s,.;:()¡!¿?«»"/-]+/).forEach(function (o) { words(o).forEach(function (w) { if (!STOP.has(w)) { out.push(form(w, o)); } }); });
    return out;
  }

  /* Calidad de la coincidencia de un término con una palabra de un campo.
     q: 1 exacta, .95 suena igual, .85 sinónimo, .75 contiene la palabra clave, .7 error tolerado, .4/.2 empieza por (débil). */
  function quality(t, w, field) {
    if (t.raw === w.raw || t.st === w.st) { return { q: 1 }; }
    if (t.ph.length >= 3 && t.ph === w.ph) { return { q: 0.95 }; }
    if (field !== 'text') {
      var L = t.st.length, allowed = L <= 4 ? 0 : L <= 8 ? 1 : 2;
      if (allowed && t.ph[0] === w.ph[0] && Math.abs(t.ph.length - w.ph.length) <= allowed &&
          Math.min(dist(t.st, w.st), dist(t.ph, w.ph)) <= allowed) { return { q: 0.7, approx: true }; }
      if (t.raw.length >= 6 && w.raw.length >= 4 && t.raw.indexOf(w.raw) !== -1) { return { q: 0.75, approx: true }; } // «fotocopias» contiene «copias»
    }
    if (w.raw.indexOf(t.raw) === 0) { return { q: t.raw.length === 1 ? 0.2 : 0.4, weak: true }; }
    return null;
  }

  var cache = {};
  function index(b) {
    if (!cache[b.id]) {
      cache[b.id] = {
        name: forms(b.name),
        tags: [].concat((b.products || []).map(function (p) { return p.n; }), b.tags || [], b.keywords || []) // productos primero: explican mejor el resultado
          .reduce(function (acc, item) { return acc.concat(words(item).filter(function (w) { return !STOP.has(w); }).map(function (w) { return form(w, item); })); }, []),
        cat: forms([b.category, b.kindLabel || ''].join(' ')),
        text: forms([b.blurb, b.description].join(' '))
      };
    }
    return cache[b.id];
  }

  function tokensOf(query) {
    var ts = words(query).filter(function (t) { return !STOP.has(t); });
    if (ts.length > 1) { ts = ts.filter(function (t) { return t.length > 1; }); }
    return ts.map(function (t) { return { main: form(t), syn: (SYN[t] || SYN[stem(t)] || []).map(function (s) { return form(s); }) }; });
  }

  /* rank(negocios, texto) -> { items, approximate, hits }
     - Sin texto útil devuelve todos en su orden.
     - Con texto: solo los negocios con relevancia suficiente, los mejores primero.
     - hits[id] = palabra de productos/etiquetas que explica el resultado (para mostrarla). */
  function rank(items, query) {
    var tokens = tokensOf(query);
    if (!tokens.length) { return { items: items.slice(), approximate: false, hits: {} }; }
    /* 1.ª pasada: mejor coincidencia de cada término en cada negocio. */
    var perDoc = items.map(function (b) {
      var idx = index(b);
      return tokens.map(function (tk) {
        var best = null;
        FIELDS.forEach(function (f) {
          idx[f[0]].forEach(function (w) {
            var m = quality(tk.main, w, f[0]);
            tk.syn.forEach(function (s) { var ms = quality(s, w, f[0]); if (ms && ms.q >= 0.95 && (!m || ms.q * 0.85 > m.q)) { m = { q: ms.q * 0.85 }; } });
            if (m) { var v = m.q * f[1]; if (!best || v > best.v) { best = { v: v, m: m, f: f[0], w: w }; } }
          });
        });
        return best;
      });
    });
    /* Si algún negocio coincide de verdad con un término (exacta o suena igual), ese término no admite
       coincidencias aproximadas en los demás: «pantalla» no trae «pastilla». */
    var exactTok = tokens.map(function (tk, i) { return perDoc.some(function (d) { return d[i] && d[i].m.q >= 0.95; }); });
    var scored = [];
    items.forEach(function (b, pos) {
      var score = 0, strong = 0, matched = 0, approx = false, hit = null;
      perDoc[pos].forEach(function (best, i) {
        if (!best || (exactTok[i] && (best.m.approx || best.m.weak))) { return; }
        matched++; score += best.v;
        if (!best.m.weak) { strong++; if (best.m.approx) { approx = true; } }
        if (!hit && best.f === 'tags' && !best.m.weak) { hit = best.w.orig; }
      });
      if (matched) { scored.push({ b: b, score: score, strong: strong, matched: matched, approx: approx, hit: hit, pos: pos }); }
    });
    var anyStrong = scored.some(function (s) { return s.strong > 0; });
    if (anyStrong) { scored = scored.filter(function (s) { return s.strong > 0; }); }
    var top = scored.reduce(function (m, s) { return Math.max(m, s.score); }, 0);
    scored = scored.filter(function (s) { return s.score >= top * 0.3; });
    scored.sort(function (x, y) { return (y.strong - x.strong) || (y.matched - x.matched) || (y.score - x.score) || (x.pos - y.pos); });
    var hits = {};
    scored.forEach(function (s) { if (s.hit) { hits[s.b.id] = s.hit; } });
    return { items: scored.map(function (s) { return s.b; }), approximate: scored.some(function (s) { return s.approx; }), hits: hits };
  }

  Cerca.search = { rank: rank, phon: phon, dist: dist, words: words, stem: stem };
})();
