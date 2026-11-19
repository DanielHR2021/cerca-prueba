/* Configuración del prototipo. Todo lo que cambia entre proveedores o entornos vive aquí. */
window.CERCA_CONFIG = {
  appName: 'Cerca', // nombre PROVISIONAL, no es una decisión
  timezone: 'America/Bogota',
  // Municipio activo. El MVP solo tiene Roldanillo, pero la interfaz lee todo de esta tabla.
  municipio: 'roldanillo',
  municipios: {
    roldanillo: {
      nombre: 'Roldanillo', departamento: 'Valle del Cauca',
      centro: [-76.1547, 4.4125], zoom: 15.5, // [lng, lat]
      // Límites del esquema de respaldo (proyecta lat/lng a porcentajes); no limitan el mapa real.
      limites: { west: -76.1590, east: -76.1504, north: 4.4160, south: 4.4090 }
    }
  },
  // 'maplibre' = mapa real (MapLibre GL JS + OpenFreeMap). 'svg' = solo el esquema de respaldo.
  // Se puede forzar con ?map=svg o ?map=maplibre.
  mapProvider: 'maplibre',
  // Para cambiar el estilo cartográfico basta con cambiar esta URL (o usar ?style=URL para probar).
  // Estilos de OpenFreeMap documentados: .../styles/liberty, .../styles/bright, .../styles/positron
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  // Estilo para el modo oscuro (verificado en el navegador: 'fiord' combina con el tema; 'dark' es casi negro).
  mapStyleDark: 'https://tiles.openfreemap.org/styles/fiord',
  // MapLibre se carga desde un CDN al abrir la página (no hay npm en este entorno). Se prueban en orden.
  maplibreVersion: '4.7.1',
  maplibreCdns: ['https://unpkg.com/maplibre-gl@{v}/dist/', 'https://cdn.jsdelivr.net/npm/maplibre-gl@{v}/dist/'],
  mapTimeoutMs: 12000
};
(function () {
  var C = window.CERCA_CONFIG, m = C.municipios[C.municipio];
  C.mapCenter = m.centro; C.mapZoom = m.zoom; C.mapBounds = m.limites; C.municipioNombre = m.nombre;
})();
