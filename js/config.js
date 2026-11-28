/* Configuración del prototipo. Todo lo que cambia entre proveedores o entornos vive aquí. */
window.CERCA_CONFIG = {
  appName: 'Nubi', // nombre de la app (decidido por el fundador, 2026-11-20)
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
  mapTimeoutMs: 12000,
  // Fuente de los negocios para js/store.js: 'demo' | 'supabase' | 'mixto' (aprobados + demostración).
  // L02 (fundador, 2026-11-22, D16): solo negocios reales aprobados. Si el servidor falla, se usa la última lista
  // guardada en el dispositivo (≤ 7 días). Los 10 ficticios quedan solo para pruebas: ?datos=demo (o ?datos=mixto).
  dataSource: 'supabase',
  // Patrocinios (preparado, apagado): solo se activa con campañas reales aprobadas y la migración 0008 aplicada.
  // Con activo = false no se hace ninguna consulta ni se muestra ningún espacio.
  patrocinios: { activo: false },
  // Forma de atender «en línea» (sin local ni zona): usa la migración 0008 (aplicada en nubi-pruebas el 2026-11-28).
  modoEnLinea: true,
  // Supabase (Etapa 1, T5): PROYECTO DE PRUEBAS «nubi-pruebas». La clave «publishable» está hecha para el
  // navegador: la protección real son las reglas por fila (RLS) de db/migraciones. La clave de servicio (privada) NUNCA va aquí.
  supabase: {
    url: 'https://swugmwjhtdauyetzisqj.supabase.co',
    publishableKey: 'sb_publishable_V7uKdrtAmFjsBpOVOyYp2w_hHxyXHr1',
    // Librería oficial con versión fija y huella de integridad (el navegador la rechaza si el CDN la altera).
    lib: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js',
    libIntegrity: 'sha384-BWcjm9OdFth9TbhCxZPdm+gAOUMAzQy9nmTs12ioXdCcbVnJaPMn+fMUoQCLt60R'
  }
};
(function () {
  var C = window.CERCA_CONFIG, m = C.municipios[C.municipio];
  C.mapCenter = m.centro; C.mapZoom = m.zoom; C.mapBounds = m.limites; C.municipioNombre = m.nombre;
})();
