/* DATOS DE DEMOSTRACIÓN. Ningún negocio de este archivo es real.
   Mismo formato que tendrá la base de datos: se reemplaza esta fuente, no la interfaz. */
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
    biz({ id: 1, name: 'Panadería Ejemplo', category: 'Comida', blurb: 'Pan caliente desde temprano.', description: 'Panes, almojábanas y tortas por encargo. Negocio de ejemplo.', keywords: ['pan', 'desayuno', 'torta', 'pastel', 'cumpleaños', 'almojabana'], hours: { from: 5, to: 19 }, moved: true, fresh: false, x: 30, y: 38 }),
    biz({ id: 2, name: 'Café Ejemplo', category: 'Café', blurb: 'Un lugar tranquilo para conversar.', description: 'Café de origen, jugos y algo dulce. Negocio de ejemplo.', keywords: ['cafe', 'tinto', 'tranquilo', 'postre', 'jugo'], hours: { from: 8, to: 22 }, moved: false, fresh: false, x: 52, y: 26 }),
    biz({ id: 3, name: 'Papelería Ejemplo', category: 'Tiendas', blurb: 'Útiles, copias e impresiones.', description: 'Cuadernos, copias, impresiones y regalos. Negocio de ejemplo.', keywords: ['copias', 'impresion', 'cuaderno', 'utiles', 'colegio'], hours: { from: 8, to: 17 }, moved: false, fresh: false, x: 64, y: 52 }),
    biz({ id: 4, name: 'Reparación de celulares Ejemplo', category: 'Servicios', blurb: 'Pantallas, baterías y cargadores.', description: 'Reparación y accesorios para celulares. Negocio de ejemplo.', keywords: ['celular', 'cargador', 'pantalla', 'bateria', 'telefono', 'computador'], hours: { from: 9, to: 18 }, moved: false, fresh: false, x: 40, y: 62 }),
    biz({ id: 5, name: 'Ropa Ejemplo', category: 'Tiendas', blurb: 'Ropa casual a buen precio.', description: 'Ropa para toda la familia. Negocio de ejemplo.', keywords: ['ropa', 'camisa', 'jean', 'vestido', 'economica'], hours: { from: 9, to: 19 }, moved: false, fresh: true, x: 74, y: 34 }),
    biz({ id: 6, name: 'Restaurante Ejemplo', category: 'Comida', blurb: 'Almuerzo del día.', description: 'Almuerzos caseros y platos típicos. Negocio de ejemplo.', keywords: ['almuerzo', 'comida', 'restaurante', 'sopa', 'economico'], hours: { from: 11, to: 16 }, moved: false, fresh: false, x: 22, y: 58 }),
    biz({ id: 7, name: 'Ferretería Ejemplo', category: 'Tiendas', blurb: 'Herramientas y materiales de obra.', description: 'Herramientas, pintura y materiales para reconstruir. Negocio de ejemplo.', keywords: ['herramienta', 'cemento', 'pintura', 'tornillo', 'obra', 'construccion'], hours: { from: 7, to: 17 }, moved: true, fresh: false, x: 84, y: 60 }),
    biz({ id: 8, name: 'Peluquería Ejemplo', category: 'Servicios', blurb: 'Corte y arreglo, con cita o sin ella.', description: 'Corte, barba y peinado. Negocio de ejemplo.', keywords: ['corte', 'pelo', 'barba', 'peinado', 'barberia'], hours: { from: 9, to: 18 }, moved: true, fresh: false, x: 56, y: 76 }),
    biz({ id: 9, name: 'Heladería Ejemplo', category: 'Comida', blurb: 'Helados y postres para la tarde.', description: 'Helados artesanales, malteadas y postres. Negocio de ejemplo.', keywords: ['helado', 'postre', 'malteada', 'dulce'], hours: { from: 14, to: 22 }, moved: false, fresh: false, x: 12, y: 34 }),
    biz({ id: 10, name: 'Farmacia Ejemplo', category: 'Servicios', blurb: 'Medicamentos y artículos de aseo.', description: 'Medicamentos de venta libre y artículos de aseo. Negocio de ejemplo.', keywords: ['medicina', 'medicamento', 'droga', 'aseo', 'pastilla'], hours: { from: 8, to: 22 }, moved: false, fresh: false, x: 68, y: 70 })
  ];
})();
