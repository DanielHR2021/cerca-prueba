/* DATOS DE DEMOSTRACIÓN. Ningún negocio de este archivo es real (nombres, productos, precios, historias y contacto).
   Mismo formato que tendrá la base de datos: se reemplaza esta fuente, no la interfaz.
   Identidad del perfil: kind (tipo de negocio → familia visual en js/profiles.js), palette e icon. */
(function () {
  var B = window.CERCA_CONFIG.mapBounds;
  // Convierte una posición en % del mapa esquemático a lat/lng (solo para la demo).
  function at(x, y) {
    return {
      lng: +(B.west + (x / 100) * (B.east - B.west)).toFixed(5),
      lat: +(B.north - (y / 100) * (B.north - B.south)).toFixed(5)
    };
  }
  function biz(o) {
    var p = at(o.x, o.y);
    o.lat = p.lat; o.lng = p.lng; delete o.x; delete o.y;
    o.demo = true; o.municipio = window.CERCA_CONFIG.municipio;
    o.address = null; o.phone = '(ficticio) 300 000 0000'; o.whatsapp = null; // contacto FICTICIO, claramente marcado
    return o;
  }
  window.CERCA_DEMO = [
    biz({ id: 1, name: 'Panadería Ejemplo', category: 'Comida', kind: 'panaderia', kindLabel: 'Panadería', palette: 'trigo', icon: 'bread', since: 1998,
      blurb: 'Pan caliente desde temprano.', description: 'Panes, almojábanas y tortas por encargo. Negocio de ejemplo.',
      keywords: ['pan', 'desayuno', 'torta', 'pastel', 'cumpleaños', 'almojabana'], tags: ['Por encargo', 'Desde las 5 a. m.'],
      products: [{ n: 'Pan de sal', d: 'Recién horneado, por docena', p: '$3.000', i: 'bread' }, { n: 'Almojábanas', d: 'Con queso costeño', p: '$1.500', i: 'bun' },
        { n: 'Torta de cumpleaños', d: 'Por encargo, con un día de anticipación', p: 'Desde $35.000', i: 'cake' }, { n: 'Tinto', d: 'Para acompañar', p: '$1.000', i: 'cup' }],
      story: 'Empezamos con un horno de leña en el patio de la casa. Hoy seguimos amasando a mano cada madrugada.',
      news: { when: 'Hoy, 5:00 a. m.', text: 'Salió la primera tanda de pan de sal.' }, hours: { from: 5, to: 19 }, moved: true, fresh: false, x: 30, y: 38 }),
    biz({ id: 2, name: 'Café Ejemplo', category: 'Café', kind: 'cafe', kindLabel: 'Café', palette: 'guayaba', icon: 'cup', since: 2019,
      blurb: 'Un lugar tranquilo para conversar.', description: 'Café de origen, jugos y algo dulce. Negocio de ejemplo.',
      keywords: ['cafe', 'tinto', 'tranquilo', 'postre', 'jugo'], tags: ['Café del Valle', 'Wifi'],
      products: [{ n: 'Café filtrado', d: 'Grano de la región', p: '$4.000', i: 'cup' }, { n: 'Jugo de lulo', d: 'En agua o en leche', p: '$5.000', i: 'glass' },
        { n: 'Pandebono', d: 'Recién salido', p: '$2.000', i: 'bun' }],
      story: 'Una sala pequeña con mesas de madera para quedarse un rato. El café viene de fincas del Valle.',
      news: { when: 'Esta semana', text: 'Probamos un café de proceso natural.' }, hours: { from: 8, to: 22 }, moved: false, fresh: false, x: 52, y: 26 }),
    biz({ id: 3, name: 'Papelería Ejemplo', category: 'Tiendas', kind: 'papeleria', kindLabel: 'Papelería', palette: 'limon', icon: 'pencil', since: 2010,
      blurb: 'Útiles, copias e impresiones.', description: 'Cuadernos, copias, impresiones y regalos. Negocio de ejemplo.',
      keywords: ['copias', 'impresion', 'cuaderno', 'utiles', 'colegio'], tags: ['Impresión a color', 'Lista escolar'],
      products: [{ n: 'Copias e impresiones', d: 'Blanco y negro o a color', p: 'Desde $200', i: 'printer' }, { n: 'Cuadernos', d: 'Cosidos y argollados', p: 'Desde $3.500', i: 'book' },
        { n: 'Kit escolar', d: 'Armamos la lista del colegio', p: 'Según la lista', i: 'pencil' }],
      story: 'Nos traen la lista del colegio y la entregamos lista en una bolsa, con el nombre del estudiante.',
      hours: { from: 8, to: 17 }, moved: false, fresh: false, x: 64, y: 52 }),
    biz({ id: 4, name: 'Reparación de celulares Ejemplo', category: 'Servicios', kind: 'tecnologia', kindLabel: 'Tecnología y celulares', palette: 'pizarra', icon: 'phone', since: 2016,
      blurb: 'Pantallas, baterías y cargadores.', description: 'Reparación y accesorios para celulares. Negocio de ejemplo.',
      keywords: ['celular', 'cargador', 'pantalla', 'bateria', 'telefono', 'computador'], tags: ['Android', 'iPhone', 'Portátiles'],
      products: [{ n: 'Cambio de pantalla', d: 'La mayoría de modelos', p: 'Desde $90.000', t: 'Mismo día', i: 'screen' },
        { n: 'Batería nueva', d: 'Con garantía del taller', p: 'Desde $70.000', t: '1 hora', i: 'battery' },
        { n: 'Cargadores y cables', d: 'Tipo C, micro USB y Lightning', p: 'Desde $15.000', t: 'Al momento', i: 'plug' },
        { n: 'Diagnóstico', d: 'Te decimos qué tiene antes de reparar', p: 'Sin costo', t: '20 min', i: 'chip' }],
      story: 'Te explicamos qué tiene tu equipo antes de tocarlo y te damos el precio por escrito.',
      news: { when: 'Ayer', text: 'Llegaron pantallas para modelos recientes.' }, hours: { from: 9, to: 18 }, moved: false, fresh: false, x: 40, y: 62 }),
    biz({ id: 5, name: 'Ropa Ejemplo', category: 'Tiendas', kind: 'ropa', kindLabel: 'Tienda de ropa', palette: 'cielo', icon: 'shirt', since: 2021,
      blurb: 'Ropa casual a buen precio.', description: 'Ropa para toda la familia. Negocio de ejemplo.',
      keywords: ['ropa', 'camisa', 'jean', 'vestido', 'economica'], tags: ['Tallas S a XXL', 'Cambios en 8 días'],
      products: [{ n: 'Jeans', d: 'Dama y caballero', p: '$60.000', i: 'shirt' }, { n: 'Camisetas', d: 'Algodón, varios colores', p: '$25.000', i: 'shirt' },
        { n: 'Vestidos', d: 'Nueva temporada', p: '$75.000', i: 'tag' }],
      story: 'Elegimos cada prenda pensando en el clima de Roldanillo: telas frescas y colores alegres.',
      news: { when: 'Esta semana', text: 'Llegó la colección de mitad de año.' }, hours: { from: 9, to: 19 }, moved: false, fresh: true, x: 74, y: 34 }),
    biz({ id: 6, name: 'Restaurante Ejemplo', category: 'Comida', kind: 'restaurante', kindLabel: 'Restaurante', palette: 'arcilla', icon: 'bowl', since: 2005,
      blurb: 'Almuerzo del día.', description: 'Almuerzos caseros y platos típicos. Negocio de ejemplo.',
      keywords: ['almuerzo', 'comida', 'restaurante', 'sopa', 'economico'], tags: ['Menú del día', 'Para llevar'],
      products: [{ n: 'Almuerzo del día', d: 'Sopa, seco, jugo y postre', p: '$14.000', i: 'bowl' }, { n: 'Sancocho de gallina', d: 'Los domingos', p: '$18.000', i: 'pot' },
        { n: 'Jugos naturales', d: 'De la fruta del día', p: '$4.000', i: 'glass' }],
      story: 'La sazón es la de la abuela: el sancocho se hace en leña los domingos.',
      news: { when: 'Hoy', text: 'Sopa de tortilla y sudado de pollo.' }, hours: { from: 11, to: 16 }, moved: false, fresh: false, x: 22, y: 58 }),
    biz({ id: 7, name: 'Ferretería Ejemplo', category: 'Tiendas', kind: 'ferreteria', kindLabel: 'Ferretería', palette: 'arcilla', icon: 'wrench', since: 1987,
      blurb: 'Herramientas y materiales de obra.', description: 'Herramientas, pintura y materiales para reconstruir. Negocio de ejemplo.',
      keywords: ['herramienta', 'cemento', 'pintura', 'tornillo', 'obra', 'construccion'], tags: ['Domicilio en el pueblo', 'Asesoría'],
      products: [{ n: 'Pintura', d: 'Mezclamos el color', p: 'Desde $25.000', i: 'paint' }, { n: 'Herramientas', d: 'Manuales y eléctricas', p: 'Varios precios', i: 'wrench' },
        { n: 'Cemento y arena', d: 'Por bulto', p: 'Consultar', i: 'box' }],
      story: 'Tres generaciones atendiendo el mismo mostrador. Si no sabes qué necesitas, te ayudamos a elegir.',
      hours: { from: 7, to: 17 }, moved: true, fresh: false, x: 84, y: 60 }),
    biz({ id: 8, name: 'Peluquería Ejemplo', category: 'Servicios', kind: 'peluqueria', kindLabel: 'Peluquería y barbería', palette: 'ciruela', icon: 'scissors', since: 2012,
      blurb: 'Corte y arreglo, con cita o sin ella.', description: 'Corte, barba y peinado. Negocio de ejemplo.',
      keywords: ['corte', 'pelo', 'barba', 'peinado', 'barberia'], tags: ['Con cita o sin ella', 'Niños'],
      products: [{ n: 'Corte clásico', d: 'Lavado incluido', p: '$15.000', t: '30 min', i: 'scissors' }, { n: 'Barba y perfilado', d: 'Toalla caliente', p: '$10.000', t: '20 min', i: 'razor' },
        { n: 'Peinado para eventos', d: 'Con cita previa', p: 'Desde $35.000', t: '1 hora', i: 'sparkle' }],
      story: 'Aquí se conversa mientras se corta. Muchos clientes vienen desde niños.',
      news: { when: 'Sábado', text: 'Abrimos desde las 8:00 a. m.' }, hours: { from: 9, to: 18 }, moved: true, fresh: false, x: 56, y: 76 }),
    biz({ id: 9, name: 'Heladería Ejemplo', category: 'Comida', kind: 'heladeria', kindLabel: 'Heladería', palette: 'menta', icon: 'icecream', since: 2017,
      blurb: 'Helados y postres para la tarde.', description: 'Helados artesanales, malteadas y postres. Negocio de ejemplo.',
      keywords: ['helado', 'postre', 'malteada', 'dulce'], tags: ['Sabores de fruta local'],
      products: [{ n: 'Helado de guanábana', d: 'Artesanal', p: '$5.000', i: 'icecream' }, { n: 'Malteada', d: 'Vainilla, fresa o chocolate', p: '$9.000', i: 'glass' },
        { n: 'Postre de natas', d: 'Receta de la casa', p: '$6.000', i: 'cake' }],
      story: 'Hacemos los helados con fruta de la región: guanábana, mango y maracuyá.',
      news: { when: 'Este fin de semana', text: 'Nuevo sabor: mango biche con sal.' }, hours: { from: 14, to: 22 }, moved: false, fresh: false, x: 12, y: 34 }),
    biz({ id: 10, name: 'Farmacia Ejemplo', category: 'Servicios', kind: 'farmacia', kindLabel: 'Farmacia', palette: 'menta', icon: 'pill', since: 2008,
      blurb: 'Medicamentos y artículos de aseo.', description: 'Medicamentos de venta libre y artículos de aseo. Negocio de ejemplo.',
      keywords: ['medicina', 'medicamento', 'droga', 'aseo', 'pastilla'], tags: ['Toma de presión', 'Domicilio'],
      products: [{ n: 'Medicamentos de venta libre', d: 'Consulta disponibilidad', p: 'Varios precios', t: 'Al momento', i: 'pill' },
        { n: 'Toma de presión', d: 'Sin cita', p: 'Sin costo', t: '5 min', i: 'heart' }, { n: 'Artículos de aseo', d: 'Cuidado personal', p: 'Varios precios', t: 'Al momento', i: 'drop' }],
      story: 'Atendemos a los vecinos del barrio desde hace años. Si no tenemos algo, te decimos dónde conseguirlo.',
      hours: { from: 8, to: 22 }, moved: false, fresh: false, x: 68, y: 70 })
  ];
})();
