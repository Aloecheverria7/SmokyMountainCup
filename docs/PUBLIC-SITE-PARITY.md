# Referencia pública y réplica React — 14 de noviembre de 2026

La fuente visual autoritativa es **https://smokymountaincup.com/** y las páginas públicas que enlaza. Se comprobó que la URL proporcionada con native_app_name=GoDaddy Android y native_app_version=9.15.6 devuelve exactamente los mismos 117403 bytes que la portada canónica (SHA-256 8d3e049ef158e43060e6dd91264f6a76404bd4e41fefcf5d73e93cc898a18387).

La validación anterior comparaba React contra un checkout PHP local que ya contenía otro diseño. Los reportes anteriores de cero diferencias se limitan a ese checkout y **no certifican el sitio publicado**. Esta entrega sustituye esa referencia para la landing y sus subpáginas. No se modificó el dominio publicado ni se enviaron sus formularios.

## Contenido inventariado

Se capturaron 19 documentos públicos, incluidos los estados de confirmación/error identificados en los manejadores originales. Las respuestas HTTP, sin cookies de sesión ni credenciales, se conservan como fixtures en tests/fixtures/published-2026-11-14; manifest.json fija el SHA-256 de cada documento. No se ejecuta PHP ni se conecta una base operativa para reproducirlos.

| Página | Contenido conservado |
| --- | --- |
| / e /index.php | Cabeceras desktop/móvil, tres diapositivas, Latest Games, tablas de horarios, carteles G2/G3/G4, League Table/Featured Video, formularios, suscripciones, galería inferior y footer. |
| /about.php | Banner, barras 7 VS 7/11 VS 11/Women, historia, fotografías, campeones 2021–2023 y contacto. Se conservan también las erratas del texto publicado. |
| /schedule.php | Banner, evento destacado, equipos, fechas y lista publicados. |
| /gallery.php | Todas las fotografías y overlays publicados, zoom y estructura original de la galería. |
| /contact.php | Banner, datos de contacto, formulario y mapa de Rocky Top Sports World. |
| /games-details.php | Datos y secciones originales del detalle. |
| /games-results.php | Resultados y tablas publicados. |
| /games-boxScores.php | Alineaciones, posiciones e iconos de goles/tarjetas con sus colores originales. |
| /games-calendar.php | Calendario y su navegación original. |
| /games-list.php | Listado original de partidos. |
| /games-blocks.php | Bloques de partidos. |
| /leaguetable.php | Clasificación publicada. |
| /player-details.php | Perfil y estadísticas publicados. |
| /player-gallery.php | Galería de jugadores publicada. |
| /player-list.php | Listado de jugadores. |
| /player-statics.php | Estadísticas originales. |
| /blog.php | Artículos, imágenes, estructura y enlaces publicados. |
| /thank-you.php | Página original de confirmación. |
| /sorry.php | Página original de error. |

Se mantienen el texto, nombres, fechas, orden de secciones, fotografías, logotipos, iconos, enlaces y diferencias de navegación entre escritorio y móvil. No se sustituyen por el diseño anterior con The game brings us together, nuevas tarjetas o textos nuevos. El centro deportivo nativo y la administración siguen disponibles por sus rutas; no se insertan elementos nuevos en la landing original.

## Animaciones y transiciones

Se conservaron los motores, CSS y configuración que usa el sitio, en lugar de aproximarlos con otro slider. La vista pública se monta como elementos React a partir de documentos estáticos versionados; no renderiza HTML recibido de usuarios ni de la API. Las bibliotecas del tema se cargan desde recursos fijados en el propio repositorio. Esta es una capa de compatibilidad con BigSlam/GoodLayers, Revolution Slider, Sportspress e iLightBox; no se afirma que esos motores hayan sido reescritos en React.

| Elemento | Configuración/comportamiento conservado |
| --- | --- |
| Hero | Tres diapositivas; capas, fondos, imágenes, botones, navegación, swipe y parámetros responsive originales. Los desfases st de capas incluyen 210, 440, 680 y 940. Se conservan literalmente data-frame_0/1/999 y data-frame_hover. |
| Parallax | Valores de portada 0, 0.01 y 0.1; About 0.2; Contact 0.3; confirmación/error 0.8. |
| Menú móvil | Apertura fadeIn 200 ms; cierre fadeOut 400 ms; entradas escalonadas de 150 ms; submenús slideDown 400 ms con easeOutQuart. |
| Cabecera | Reglas de logo, navegación fija, dimensiones y breakpoints originales; transiciones de padding/altura de 200 ms donde las define el tema. |
| Galerías | Zoom y overlays originales; lightbox de imágenes de la portada; toolbar/cierre y grupos del plugin. |
| Secciones | Efectos de entrada al viewport, barras de progreso, fondos y alturas sincronizadas de GoodLayers. |
| Vuelta al inicio | Scroll suave de 1500 ms con easeOutQuart del tema. |
| Botones/iconos | Tipografía Jost, fuentes de iconos, bordes, cambios de color/opacidad y prioridades CSS originales. |

Se corrigieron dos incompatibilidades de la migración: jQuery.ready debía esperar todas las dependencias de easing, y los estilos inline !important necesitaban conservar su prioridad al convertirse a elementos React. No se desactivan globalmente las animaciones en la aplicación. Para funcionar con la CSP de producción sin habilitar unsafe-eval, se sustituyeron únicamente la sonda de Internet Explorer basada en Function y la lectura eval de las opciones numéricas width/height de iLightBox por equivalentes sin ejecución de cadenas. El inventario registra los hashes anteriores y posteriores; se conserva el runtime original independiente para la comparación.

## Recursos y comportamiento existente

[Inventario de recursos](published-reference-assets.json) registra URL, hash original y hash empaquetado. Las 14 hojas de estilo y el runtime modificado se conservan además en tests/fixtures/published-original-assets con sus bytes originales, independientemente de los recursos de la réplica; los demás recursos de referencia se verifican contra su SHA-256 original antes de servirlos. Fotografías y fuentes se mantienen sin recomprimir ni sustituir; las referencias de CSS y dependencias externas se localizan sin modificar sus reglas. .gitattributes evita que Git altere los bytes de fixtures y recursos al cambiar de plataforma.

Tres recursos del sitio ya devolvían 404 al inspeccionarlos: upload/Naby-Keïta-300x300.jpg, plugins/goodlayers-core/plugins/arrow-prev-icon-64.png y plugins/google-map-plugin/assets/images/nav.png. No se inventaron reemplazos. El enlace de paginación page/2/index.htm también devuelve 404 en el dominio original; se conserva el enlace sin fabricar otra página. Los iconos de película de la galería publicada carecen de href; no se les asignaron videos nuevos. La portada conserva sus enlaces de imágenes y su video Facebook. El mapa y los embeds externos mantienen sus URLs.

Los formularios originales de inscripción, vendedores y contacto conservan campos y páginas de destino. El envío se adapta al endpoint NestJS con CSRF, sin mensajes de éxito antes de una respuesta aceptada. Product es opcional en el formulario publicado de vendedores y se conserva en el mensaje cuando se suministra. La suscripción publicada usa action=# sin proveedor de newsletter conectado; se conserva su navegación de recarga y no se afirma guardar suscriptores ni se envían correos de suscripción inventados.

## Verificación y límites medidos

- Comparación del build de producción NestJS con CSP activa: 19 páginas × 4 anchos (360, 390, 768 y 1440), 76 casos con iguales dimensiones y cero píxeles diferentes detectados por pixelmatch con threshold 0.1, después de resolver las diferencias encontradas.
- Se cargan los recursos fijados, se espera a las fuentes y a que terminen las entradas/scroll. Solo para fijar una captura comparable se pausa el slider en la misma diapositiva; su avance se comprueba aparte mediante el control real de siguiente.
- Las capturas enmascaran **solo los iframes externos**. Facebook/YouTube/Google controlan contenido y permisos del interior de sus embeds, por lo que no se certifica su contenido variable píxel a píxel. Sus URLs, dimensiones y marcos se conservan. No se enmascaran secciones propias ni se ocultan diferencias del sitio.
- Pruebas de interacción: slider, menú móvil, formularios con respuestas simuladas, zoom, lightbox de portada, prioridades de iconos y scroll al inicio. No se envían mensajes a producción.
- Las capturas y diferencias se guardan en artifacts y no se suben a Git. Los resultados resumidos se registran en [published-parity-report.json](published-parity-report.json). El inventario DOM normaliza únicamente el origen local distinto de ambos servidores para comparar las URLs de imágenes que Revolution Slider convierte en absolutas.

Estos resultados corresponden a la captura del 14 de noviembre de 2026 y los entornos/tamaños indicados. No equivalen a una promesa de igualdad de cada fotograma en todos los navegadores, conexiones o contenidos futuros del dominio. Un cambio del sitio publicado requiere una nueva captura y comparación.

## Repetir

```sh
npm ci
npm run build
npm run test:parity
npm run test:e2e -- landing.e2e.ts
```

La comparación inicia por defecto el build de producción de NestJS con CSP activa, sin DB ni SMTP. Usa exclusivamente referencias y servidores locales. No necesita LEGACY_ROOT ni producción. El comparador anterior queda como test:parity:legacy para trazabilidad, sin considerarlo referencia del dominio actual. `npm run capture:published -- tests/fixtures/published-2026-11-14` regenera los documentos React y scripts de inicialización desde la captura fijada.

## Actualización de datos — 15 de noviembre de 2026

La captura estática de esta entrega se usa como referencia editorial y visual, pero las regiones deportivas ya consumen la API del panel. Ver [PUBLIC-DATA.md](PUBLIC-DATA.md). El comparador actual coloca el mismo DOM deportivo conectado en la referencia original y en React para aislar estilos y contenedores; los resultados API se verifican independientemente mediante escrituras reales en la prueba del panel. El reporte del 14 de noviembre corresponde a la réplica estática anterior y no demuestra conectividad con NestJS.
