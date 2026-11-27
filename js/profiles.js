/* Sistema de perfiles comerciales: una estructura común (portada, acciones, novedad, destacados,
   historia, información) con variaciones controladas por familia visual, paleta e icono.
   Familia = tipo de negocio (horno, tecno, oficio, mercado): cambia patrón, forma, tipografía y cómo
   se presentan los destacados. Paleta = colores claros y oscuros con contraste comprobado. */
(function () {
  window.Cerca = window.Cerca || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var P = {
    bread: 'M4 11a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4c0 1.2-.7 2-1.5 2.3V19h-13v-5.7C4.7 13 4 12.2 4 11Z M9 10.5v2 M12 10v2.5 M15 10.5v2',
    bun: 'M4 15c0-4 3.6-7 8-7s8 3 8 7H4Z M3.5 15h17 M5.5 18h13 M9.5 11l1 1.5 M14.5 11l-1 1.5',
    cake: 'M4 20h16 M5 20v-6h14v6 M5 16.2c2 1.2 4.7 1.2 7 0s5-1.2 7 0 M12 14v-3 M12 8.5c.8-.7.8-1.6 0-2.5-.8.9-.8 1.8 0 2.5Z',
    cup: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16 M8 3.5c-.6.8-.6 1.7 0 2.5 M11.5 3.5c-.6.8-.6 1.7 0 2.5',
    glass: 'M6 4h12l-1.5 15.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5L6 4Z M6.6 10h10.8 M13 4l2-2',
    bowl: 'M3.5 11h17a8.5 8.5 0 0 1-17 0Z M8 20h8 M9 7c0-1 1-1.5 1-2.5 M13.5 7c0-1 1-1.5 1-2.5',
    pot: 'M4 9h16 M5 9v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V9 M2.5 11H5 M19 11h2.5 M10 6h4',
    icecream: 'M7.5 10a4.5 4.5 0 1 1 9 0 M7 10h10l-5 11-5-11Z M9.5 13.5l3 2',
    phone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5Z M11 18.5h2',
    screen: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5Z M6.5 6h11 M6.5 17h11 M10 9.5l4 4 M14 9.5l-1.5 1.5',
    battery: 'M3 8h15v8H3z M18 10.5h2.5v3H18 M6 11v2 M9 11v2 M12 11v2',
    plug: 'M9 3v5 M15 3v5 M7 8h10v3a5 5 0 0 1-10 0V8Z M12 16v5',
    chip: 'M7 7h10v10H7z M10 10h4v4h-4z M9.5 3v4 M14.5 3v4 M9.5 17v4 M14.5 17v4 M3 9.5h4 M3 14.5h4 M17 9.5h4 M17 14.5h4',
    wrench: 'M14 4a4.5 4.5 0 0 0 5.6 5.9L10 19.5a2.1 2.1 0 1 1-3-3l9.6-9.6A4.5 4.5 0 0 1 14 4Z',
    paint: 'M4 4h13v5H4z M17 6.5h2.5V12h-8v3 M10 15h3v6h-3z',
    box: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z M3.5 7.5 12 12l8.5-4.5 M12 12v9',
    scissors: 'M6 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M6 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M8 7.5 20 17 M8 16.5 20 7',
    razor: 'M4 15l7-7 3 3-7 7z M11 8l3-3 5 5-3 3 M7.5 18.5 5.5 20.5',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
    shirt: 'M8.5 3.5 4 6l1.5 4H8v10.5h8V10h2.5L20 6l-4.5-2.5c-.5 1.5-1.9 2.5-3.5 2.5s-3-1-3.5-2.5Z',
    tag: 'M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z M8 8.5h.01',
    pencil: 'M15.5 4.5l4 4L8 20H4v-4z M13 7l4 4',
    printer: 'M7 9V3.5h10V9 M5 9h14a1.5 1.5 0 0 1 1.5 1.5V16H17 M7 16H3.5v-5.5A1.5 1.5 0 0 1 5 9 M7 13h10v7.5H7z',
    book: 'M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z M5 18a2 2 0 0 1 2-2h11 M9 8h5',
    pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z M7.5 10.5l6 6',
    heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z M8 12h2l1.2-2 1.6 4 1.2-2h2',
    drop: 'M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
    store: 'M4 10v10h16V10 M3 10l2-6h14l2 6z M9.5 20v-5h5v5',
    bag: 'M5 8h14l-1 12.5H6z M9 8V6.5a3 3 0 0 1 6 0V8',
    call: 'M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z',
    chat: 'M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8z M8.5 9.5h7 M8.5 12.5h4',
    pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    share: 'M12 3.5v11 M8 7.5l4-4 4 4 M5 12v7.5h14V12',
    flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
    save: 'M6.5 3.5h11v17l-5.5-4-5.5 4z',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2'
  };
  var ICON_NAMES = { bread: 'Pan', bun: 'Pan dulce', cake: 'Torta', cup: 'Taza', glass: 'Vaso', bowl: 'Plato', pot: 'Olla', icecream: 'Helado', phone: 'Celular',
    screen: 'Pantalla', battery: 'Batería', plug: 'Cargador', chip: 'Circuito', wrench: 'Herramienta', paint: 'Pintura', box: 'Caja', scissors: 'Tijeras',
    razor: 'Cuchilla', sparkle: 'Brillo', shirt: 'Ropa', tag: 'Etiqueta', pencil: 'Lápiz', printer: 'Impresora', book: 'Cuaderno', pill: 'Medicamento',
    heart: 'Salud', drop: 'Gota', store: 'Tienda', bag: 'Bolsa' };
  function icon(name, size) {
    return '<svg width="' + (size || 24) + '" height="' + (size || 24) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + (P[name] || P.store) + '"/></svg>';
  }

  /* Paletas: cover (portada), tint (fichas), surface (fondo de página), ink (texto), accent y onAccent.
     Contraste comprobado (claro y oscuro): texto sobre portada, fichas y fondo, onAccent sobre accent y accent sobre
     fondo y fichas, todos ≥ 4,5:1 (WCAG AA). Para añadir una paleta, repetir esa comprobación. */
  var PALETTES = {
    trigo:   { label: 'Trigo',    l: ['#F6D9A8', '#FBEBD0', '#FFFAF2', '#3B2412', '#A84F15', '#FFFFFF'], d: ['#3A2A1A', '#2E2116', '#1E1610', '#F7E7CF', '#F2B36B', '#2A1A0C'] },
    guayaba: { label: 'Guayaba',  l: ['#F7C9D2', '#FCE6EA', '#FFF7F8', '#3D1520', '#A8324E', '#FFFFFF'], d: ['#3B1E26', '#2E1820', '#1D1116', '#FBE3E8', '#F4A0B4', '#2A0F16'] },
    menta:   { label: 'Menta',    l: ['#CBEBDD', '#E4F5EC', '#F7FCF9', '#12372B', '#1D7352', '#FFFFFF'], d: ['#173A2E', '#142E25', '#0E1D18', '#DDF3E8', '#7FD4AE', '#0D2A20'] },
    arcilla: { label: 'Arcilla',  l: ['#F1D6C8', '#F8E8E0', '#FFF9F6', '#3A1C10', '#9E4428', '#FFFFFF'], d: ['#3A2219', '#2D1C15', '#1C120E', '#F7E4DA', '#F0A88A', '#2A140B'] },
    pizarra: { label: 'Pizarra',  l: ['#DCE6F2', '#EDF2F9', '#FFFFFF', '#0F1E33', '#1D5FD1', '#FFFFFF'], d: ['#15233A', '#111D30', '#0B1422', '#E3ECF8', '#8DB6FF', '#0A1830'] },
    grafito: { label: 'Grafito',  l: ['#E4E4E7', '#F1F1F3', '#FFFFFF', '#18181B', '#0F766E', '#FFFFFF'], d: ['#232327', '#1B1B1F', '#121214', '#EDEDF0', '#5EEAD4', '#08201D'] },
    ciruela: { label: 'Ciruela',  l: ['#E6D3EE', '#F3E9F7', '#FDF9FF', '#2A1338', '#7B2E9E', '#FFFFFF'], d: ['#2E1A3A', '#24152E', '#170D1E', '#F1E4F8', '#D3A6F0', '#20102B'] },
    cielo:   { label: 'Cielo',    l: ['#CFE6F3', '#E6F2F9', '#FAFDFF', '#0E2C3D', '#1C6790', '#FFFFFF'], d: ['#16303F', '#13283A', '#0C1A24', '#E0EFF7', '#8CCBEA', '#0A2230'] },
    limon:   { label: 'Limón',    l: ['#E4EFC4', '#F1F7E0', '#FCFEF6', '#263212', '#4A6711', '#FFFFFF'], d: ['#28331A', '#222B16', '#151B0E', '#EAF2D6', '#C2DE7E', '#1A240A'] }
  };

  var FAMILIES = {
    horno:   { label: 'Cálido y artesanal', feat: 'Lo más pedido', story: 'Nuestra historia', layout: 'tiles', palettes: ['trigo', 'guayaba', 'menta', 'arcilla'], icons: ['bread', 'bun', 'cake', 'cup', 'glass', 'bowl', 'pot', 'icecream'] },
    tecno:   { label: 'Limpio y preciso', feat: 'Servicios y precios', story: 'Cómo trabajamos', layout: 'rows', palettes: ['pizarra', 'grafito', 'cielo'], icons: ['phone', 'screen', 'battery', 'plug', 'chip', 'wrench'] },
    oficio:  { label: 'Cercano y de confianza', feat: 'Servicios', story: 'Quiénes te atienden', layout: 'rows', palettes: ['ciruela', 'arcilla', 'pizarra'], icons: ['scissors', 'razor', 'sparkle', 'heart', 'drop', 'wrench'] },
    mercado: { label: 'Tienda de barrio', feat: 'Productos destacados', story: 'Sobre la tienda', layout: 'shelf', palettes: ['cielo', 'limon', 'arcilla', 'menta'], icons: ['store', 'bag', 'shirt', 'tag', 'pencil', 'printer', 'book', 'paint', 'wrench', 'box', 'pill', 'drop'] }
  };
  var KINDS = {
    panaderia:   { label: 'Panadería', family: 'horno', icon: 'bread', category: 'Comida' },
    cafe:        { label: 'Café', family: 'horno', icon: 'cup', category: 'Café' },
    heladeria:   { label: 'Heladería', family: 'horno', icon: 'icecream', category: 'Comida' },
    restaurante: { label: 'Restaurante', family: 'horno', icon: 'bowl', category: 'Comida' },
    tecnologia:  { label: 'Tecnología y celulares', family: 'tecno', icon: 'phone', category: 'Servicios' },
    peluqueria:  { label: 'Peluquería y barbería', family: 'oficio', icon: 'scissors', category: 'Servicios' },
    servicio:    { label: 'Otro servicio', family: 'oficio', icon: 'wrench', category: 'Servicios' },
    ropa:        { label: 'Tienda de ropa', family: 'mercado', icon: 'shirt', category: 'Tiendas' },
    papeleria:   { label: 'Papelería', family: 'mercado', icon: 'pencil', category: 'Tiendas' },
    ferreteria:  { label: 'Ferretería', family: 'mercado', icon: 'wrench', category: 'Tiendas' },
    farmacia:    { label: 'Farmacia', family: 'mercado', icon: 'pill', category: 'Servicios' },
    tienda:      { label: 'Otra tienda', family: 'mercado', icon: 'store', category: 'Tiendas' }
  };
  function familyOf(b) { return (KINDS[b.kind] || KINDS.tienda).family; }
  function paletteOf(b) { var f = FAMILIES[familyOf(b)]; return PALETTES[b.palette] ? b.palette : f.palettes[0]; }
  /* Variables CSS de la paleta para claro (--l*) y oscuro (--d*); el CSS elige según el tema. */
  function vars(b) {
    var p = PALETTES[paletteOf(b)], k = ['c', 't', 's', 'i', 'a', 'o'], out = '';
    k.forEach(function (x, n) { out += '--l' + x + ':' + p.l[n] + ';--d' + x + ':' + p.d[n] + ';'; });
    return out;
  }

  function feat(b, fam) {
    var items = (b.products || []).filter(function (p) { return p && p.n; });
    if (!items.length) { return ''; }
    var body;
    if (fam.layout === 'rows') {
      body = '<ul class="pf-rows">' + items.map(function (p) {
        return '<li class="pf-row"><span class="pf-ico">' + icon(p.i || b.icon) + '</span><span class="pf-row-main"><strong>' + esc(p.n) + '</strong>' + (p.d ? '<span>' + esc(p.d) + '</span>' : '') + '</span>' +
          '<span class="pf-row-end">' + (p.p ? '<strong class="pf-price">' + esc(p.p) + '</strong>' : '') + (p.t ? '<span class="pf-time">' + icon('clock', 14) + esc(p.t) + '</span>' : '') + '</span></li>';
      }).join('') + '</ul>';
    } else {
      body = '<ul class="pf-tiles">' + items.map(function (p) {
        return '<li class="pf-tile"><span class="pf-ico">' + icon(p.i || b.icon, fam.layout === 'shelf' ? 30 : 26) + '</span><strong>' + esc(p.n) + '</strong>' + (p.d ? '<span>' + esc(p.d) + '</span>' : '') +
          (p.p ? '<span class="pf-price">' + esc(p.p) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    return '<section class="pf-sec" aria-labelledby="pf-feat-h"><h2 id="pf-feat-h">' + esc(fam.feat) + '</h2>' + body + '</section>';
  }

  var CONTACT_LABEL = { whatsapp: 'WhatsApp', telefono: 'Teléfono', correo: 'Correo', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', web: 'Web' };
  /* render(b, h): h = { statusHtml, hoursText, isSaved, place, dept, preview }. Devuelve HTML. */
  /* Texto de «Cómo atiende» en la ficha: la zona de cobertura no es la ubicación del negocio. */
  var ATIENDE_TXT = {
    local: function () { return 'Recibe clientes en su local'; },
    zona: function (b) { var z = b.location.zone && b.location.zone.name; return (b.delivery ? 'A domicilio' : 'Atiende por zona') + (z ? ' en ' + z : '') + '. No tiene local abierto al público ni dirección publicada.'; },
    en_linea: function (b) { return 'En línea (redes, WhatsApp o web)' + (b.delivery ? ', con domicilios' : '') + '. No tiene local abierto al público.'; }
  };
  function render(b, h) {
    var famKey = familyOf(b), fam = FAMILIES[famKey], kind = KINDS[b.kind] || KINDS.tienda, preview = !!h.preview;
    var photo = b.cover ? ' has-photo" style="background-image:url(' + b.cover + ')' : '';
    var badge = b.logo ? '<img class="pf-logo" src="' + b.logo + '" alt="Logotipo de ' + esc(b.name) + '" decoding="async">' : '<span class="pf-logo pf-logo--icon">' + icon(b.icon || kind.icon, 30) + '</span>';
    var kindLine = esc(b.kindLabel || kind.label) + ' en ' + esc(h.place) + (b.since ? ', desde ' + b.since : '');
    var local = !Cerca.store || Cerca.store.attendMode(b) === 'local' || (preview && !b.location);
    var dis = function (why) { return ' aria-disabled="true" data-why="' + esc(why) + '"'; };
    var contactWhy = preview ? 'En la vista previa los botones no hacen nada.' : b.demo ? 'Contacto ficticio: este negocio es de prueba.' : 'Este negocio no publicó este contacto.';
    // Entrega B: enlaces directos solo con un contacto válido publicado; si no, el botón se ve inactivo y lo explica.
    var S = Cerca.store, cOf = function (k) { var c = (b.contacts || []).filter(function (x) { return x.kind === k; })[0]; return c && S ? S.contactHref(k, c.value) : null; };
    var tel = preview ? null : cOf('telefono') || (cOf('whatsapp') ? 'tel:' + (b.contacts.filter(function (x) { return x.kind === 'whatsapp'; })[0].value) : null), wa = preview ? null : cOf('whatsapp');
    var link = function (href, act, ic, label, ext) { return '<a class="pf-act" data-pf-act="' + act + '" href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + icon(ic, 22) + '<span>' + label + '</span></a>'; };
    var actions =
      (tel ? link(tel, 'call', 'call', 'Llamar') : '<button type="button" class="pf-act" data-pf-act="call"' + dis(contactWhy) + '>' + icon('call', 22) + '<span>Llamar</span></button>') +
      (wa ? link(wa, 'chat', 'chat', 'WhatsApp', true).replace('class="pf-act"', 'class="pf-act' + (local ? '' : ' pf-act--main') + '"') : '<button type="button" class="pf-act" data-pf-act="chat"' + dis(contactWhy) + '>' + icon('chat', 22) + '<span>WhatsApp</span></button>') +
      // Solo los negocios con local tienen «Cómo llegar»: nunca se ofrece navegación hacia quien no recibe clientes.
      (local ? '<button type="button" class="pf-act pf-act--main" data-pf-act="map"' + (preview ? dis('En la vista previa los botones no hacen nada.') : '') + '>' + icon('pin', 22) + '<span>Cómo llegar</span></button>' : '') +
      '<button type="button" class="pf-act" data-pf-act="share"' + (preview ? dis('En la vista previa los botones no hacen nada.') : '') + '>' + icon('share', 22) + '<span>Compartir</span></button>' +
      (preview ? '<button type="button" class="pf-act"' + dis('En la vista previa los botones no hacen nada.') + '>' + icon('save', 22) + '<span>Guardar</span></button>'
        : '<button type="button" class="pf-act" data-save="' + b.id + '" aria-pressed="' + h.isSaved(b.id) + '">' + icon('save', 22) + '<span class="save-lbl">' + (h.isSaved(b.id) ? 'Guardado' : 'Guardar') + '</span></button>');
    var gallery = (b.gallery || []).length ? '<section class="pf-sec" aria-labelledby="pf-gal-h"><h2 id="pf-gal-h">Fotos</h2><ul class="pf-gallery">' +
      b.gallery.map(function (src, n) { return '<li><img src="' + src + '" alt="Foto ' + (n + 1) + ' de ' + esc(b.name) + '" loading="lazy"></li>'; }).join('') + '</ul></section>' : '';
    var html = '<div class="pf-page pfv pf--' + famKey + '" style="' + vars(b) + '">' +
      '<div class="pf">' +
      (preview ? '' : '<a class="back" href="#/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Volver a explorar</a>') +
      '<header class="pf-cover' + photo + '"><span class="pf-art" aria-hidden="true">' + icon(b.icon || kind.icon, 200) + '</span>' + badge +
        '<p class="pf-kind">' + kindLine + '</p><h1 id="profile-title" tabindex="-1">' + esc(b.name) + '</h1>' +
        (b.blurb ? '<p class="pf-pitch">' + esc(b.blurb) + '</p>' : '') + '<div class="card-meta pf-meta">' + h.statusHtml(b) + '</div></header>' +
      '<div class="pf-actions" role="group" aria-label="Acciones rápidas">' + actions + '</div>' +
      '<p class="pf-note" role="status" hidden></p>' +
      (b.news && b.news.text ? '<aside class="pf-news" aria-label="Novedad"><span class="pf-news-when">' + esc(b.news.when || 'Hoy') + '</span><p>' + esc(b.news.text) + '</p></aside>' : '') +
      feat(b, fam) +
      (b.story ? '<section class="pf-sec pf-story" aria-labelledby="pf-story-h"><h2 id="pf-story-h">' + esc(fam.story) + '</h2><p>' + esc(b.story) + '</p>' +
        ((b.tags || []).length ? '<ul class="pf-tags">' + b.tags.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') + '</section>' : '') +
      gallery +
      '<section class="pf-sec pf-info" aria-labelledby="pf-info-h"><h2 id="pf-info-h">Cuándo y dónde</h2><dl>' +
        '<dt>Horario</dt><dd>' + esc(h.hoursText(b)) + '</dd>' +
        (Cerca.store && b.location ? '<dt>Cómo atiende</dt><dd>' + esc(ATIENDE_TXT[Cerca.store.attendMode(b)](b)) + '</dd>' : '') +
        '<dt>Municipio</dt><dd>' + esc(h.place) + ', ' + esc(h.dept) + '</dd>' +
        (local ? '<dt>Dirección</dt>' + (b.location && b.location.address ? '<dd>' + esc(b.location.address) + '</dd>'
          : '<dd class="placeholder">' + (preview ? '[La añadirás al registrarte]' : 'Sin dirección publicada') + '</dd>') : '') +
        // Solo contactos publicados; nunca un teléfono de relleno como si fuera real.
        '<dt>Contacto</dt>' + ((b.contacts || []).length ? '<dd class="pf-contacts">' + b.contacts.map(function (c) {
            var href = Cerca.store ? Cerca.store.contactHref(c.kind, c.value) : null, lbl = CONTACT_LABEL[c.kind] || c.kind, shown = c.kind === 'web' ? c.value.replace(/^https:\/\//, '') : /^(instagram|tiktok)$/.test(c.kind) ? '@' + c.value : c.value;
            return href && !preview ? '<a href="' + esc(href) + '"' + (/^https/.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(lbl) + ': ' + esc(shown) + '</a>' : '<span>' + esc(lbl) + ': ' + esc(shown) + '</span>';
          }).join('') + '</dd>' : '<dd class="placeholder">Sin contacto publicado</dd>') + '</dl>' +
        (b.delivery || (b.payments || []).length ? '<p class="pf-extra">' + (b.delivery ? 'Hace domicilios. ' : '') + ((b.payments || []).length ? 'Pagos: ' + esc(b.payments.join(', ')) + ' (informativo).' : '') + '</p>' : '') +
        (b.demo ? '<p class="demo-note"><strong>Datos de prueba.</strong> Este negocio, sus productos, precios e historia son ficticios.</p>' : '') +
        // Reportar (solo negocios reales publicados; nunca en la vista previa ni en la demo)
        (!preview && !b.demo && b.uid ? '<p class="pf-report"><button type="button" class="pf-report-btn" data-reportar="' + esc(b.uid) + '" data-nombre="' + esc(b.name) + '">' + icon('flag', 16) + '<span>Reportar un problema con este negocio</span></button></p>' : '') + '</section>' +
      '</div></div>';
    // La vista previa convive en el DOM con el perfil: ids distintos para no duplicarlos.
    return preview ? html.replace(/(id|aria-labelledby)="pf-/g, '$1="pv-').replace('id="profile-title"', 'id="preview-title"') : html;
  }

  Cerca.profiles = { render: render, icon: icon, vars: vars, familyOf: familyOf, paletteOf: paletteOf, PALETTES: PALETTES, FAMILIES: FAMILIES, KINDS: KINDS, ICON_NAMES: ICON_NAMES };
})();
