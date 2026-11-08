# Revisión del sitio — 15 de octubre de 2026

> Este documento describe la auditoría anterior a la implementación del panel. Para el estado actual, instalación y operación, consultar [INSTALACION.md](INSTALACION.md).

## Alcance y límites

Se revisaron la estructura, referencias entre archivos, páginas PHP, plantillas compartidas, formularios, consultas, JavaScript del marcador y recursos locales. Se comprobó la sintaxis de los 111 PHP y se ejecutaron 20 páginas con solicitudes GET simuladas mediante PHP CLI 8.2.12. No se enviaron correos, modificaron partidos ni importaron bases de datos. No se ha validado visualmente en navegador ni probado la entrega de correo o el funcionamiento con las bases de datos de producción.

“Renderiza” significa que PHP genera la página sin diagnósticos; no certifica menús, carruseles, filtros, mapas, responsive ni enlaces externos.

## Estado por componente

| Componente | Uso detectado | Estado y pendiente |
| --- | --- | --- |
| `index.php` | Entrada principal | Renderiza; compone cabecera, slider, marcador estático, vídeo, inscripción, suscripción, vendedores y galería. |
| `about.php`, `contact.php`, `gallery.php`, `schedule.php` | Navegación principal | Renderizan; revisar contenido y visualización. Schedule y galería conservan ejemplos de plantilla. |
| `games-*.php` | Menú SportsPress | Las seis páginas renderizan. Son vistas de plantilla; no se encontró integración de estas vistas con el backend del marcador. |
| `php/secction/marcador.php` | Incluido por la portada | Funciona como contenido estático. “Latest Games” muestra tablas HTML; no consulta resultados en vivo. |
| `inscriptionmail.php` | Formulario de inscripción de la portada | Handler implementado con `mail()`; validación básica. Entrega no comprobada. No guarda inscripciones en BD. |
| `sellermail.php` | Formulario de vendedores de la portada | Handler implementado con `mail()`; entrega no comprobada. |
| `mail.php` | Contacto | Handler implementado; entrega no comprobada. Usa `FILTER_SANITIZE_STRING`, obsoleto en PHP 8.2. |
| Suscripción en portada y pie | Formularios visibles | Incompleta: `action="#"`; no se encontró almacenamiento ni servicio de suscripción conectado. El pie invoca `newsletter_check`, cuya definición no aparece en los recursos locales. |
| Búsqueda de la cabecera | Formulario visible | Envía `s` a `index.php`; no se encontró lógica que procese la búsqueda. |
| `services.php` | Sin acceso desde la portada detectado | Falla en GET: usa `$conn` sin establecer conexión. Mezcla plantilla de servicios con formulario de estadísticas. |
| `update_stats.php` | Destino del formulario anterior | No actualiza estadísticas: contiene una consulta de grupos por GET aunque el formulario envía POST. |
| `fetch_groups.php`, `fetch_teams.php` | Dependencias de services | Dependen de tablas categories/groups/teams/group_teams y configuración MySQL. Entrada concatenada a SQL sin parametrizar. |
| `categories.php` | Sin acceso desde la portada detectado | Requiere otra configuración MySQL y tabla `equipos`; no comprobada con BD. Credenciales incrustadas y salida sin escape HTML. |
| `score/index.html` y `score/index.js` | Módulo independiente, sin enlace detectado desde inicio | Incompleto: solicita `get_team_ids.php`, ausente. Intenta parsear de nuevo una respuesta que jQuery puede haber interpretado por su Content-Type JSON. |
| `score/start_game.php` | Usado por score/index.js | Crea partidos mediante consulta preparada; faltan validación y control de acceso. No probado con BD. |
| `score/record_goal.php` | Usado por score/index.js | Roto: no llama a `connect()` ni obtiene `gameId` del JSON. |
| `score/update_game_state.php` | Usado por score/index.js | Actualiza ID 1 fijo y no persiste `gameTime`. El temporizador del cliente envía “in progress” incluso después de pausa/final. |
| `score/score.php` | API alternativa sin consumidor detectado | Consultas de escritura con valores concatenados y sin autenticación visible. No probado con BD. |
| `score/sports_db.sql` | Esquema disponible del marcador | Incluye games/goals/teams, pero no las tablas requeridas por services. No basta para reproducir todo el sitio. |
| `blog.php`, `player-*.php`, `leaguetable.php` | Sin acceso activo desde inicio detectado | Renderizan; candidatos a retirar del menú futuro o adaptar. Mantienen contenido de plantilla. |
| `thank-you.php`, `sorry.php` | Redirecciones de formularios | Renderizan. Son dependencias activas aunque no estén en el menú. |

## Recursos usados y candidatos a limpieza

La plantilla compartida carga Bootstrap CSS/JS, jQuery y migrate, Slider Revolution, GoodLayers, SportsPress, estilos propios, mapas y estilos Owl Carousel. Estos recursos están referenciados; eso no implica que cada página necesite todos. El CSS de Bootstrap es 5.0.2 y el JS 5.3.3; conviene unificar versiones durante la revisión visual.

Slider Revolution es necesario para la portada. GoodLayers proporciona componentes de plantilla y lightbox. Se conservaron sus archivos para evitar romper el diseño. El pie carga `js/plugins.js`; `js/script-core.js` no tiene una referencia activa detectada y empieza con código similar. No se deben cargar ambos sin compararlos completos.

Owl Carousel tiene CSS global, pero no se detectó carga de su JS en la plantilla. `announcements.php` contiene un carrusel Owl aislado sin inicialización y no está incluido por inicio. `Shop.php` es un fragmento Slider Revolution, no una tienda implementada.

`php/text.php` sí se incluye en todas las páginas y contiene datos de una empresa de limpieza. `contact2.php` contiene configuración de un café y no es el destino de los formularios actuales. `mail/contact.php`, `php/bd.php`, `images/marcador.php`, `temp.php`, los captchas y varias secciones de noticias, resultados, calendario, jugadores y servicios son candidatos a revisión. Los archivos con `(1)` son variantes paralelas. No se eliminó ninguno.

Quform conserva librerías antiguas: tres PHP no pasan la sintaxis de PHP 8.2 (`lib/JSON.php`, `lib/PHPMailerAutoload.php`, `lib/Quform/Validator/CreditCard.php`). Los formularios principales usan handlers propios; tener clases CSS `quform` no demuestra que usen su backend. Antes de retirar el plugin hay que revisar las páginas secundarias y sus estilos.

## Optimizaciones realizadas

- Corregido el cierre de head, atributos pegados en cabecera, texto alternativo de los logos y una etiqueta de enlace rota en schedule.
- Sustituida la segunda inclusión de cabecera por el pie en games-calendar y games-blocks; ahora generan un solo head/body.
- Eliminada la segunda inicialización del mismo slider en el pie, que tenía dimensiones diferentes. Se conserva la primera configuración.
- Reparados dos errores de sintaxis JavaScript del pie: JSON del estilo de mapa y HTML del indicador del slider. Los diez scripts inline del pie compilan con Node. La inicialización del slider comprueba que el elemento exista en páginas interiores.
- Generadas diez copias JPEG de visualización para siete originales: 550 px y, cuando hay resolución suficiente, 1100 px. Se respeta orientación EXIF y no se amplían imágenes pequeñas.
- Actualizadas las siete llamadas visibles en portada para usar las copias. Las tres imágenes G2/G3/G4 tienen srcset para elegir resolución según pantalla. Se conservan las imágenes originales.
- Carga diferida y decodificación asíncrona en imágenes de galería, marcador y pie. Logos y slider inicial se mantienen fuera de esta carga diferida.
- Corregidos tres enlaces del lightbox de portada para que abran la imagen de su miniatura.

Los siete originales suman 4.62 MB; sus copias de 550 px suman 0.59 MB: 87.1 % menos para ese conjunto, no para la página completa. Con las tres variantes de 1100 px, el conjunto suma aproximadamente 1.16 MB. La elección depende del navegador. No se ha medido LCP ni velocidad de red.

## Evidencia reproducible

Desde la raíz del proyecto:

```text
python tools/audit_site.py
python tools/verify_site.py
powershell -File tools/optimize-images.ps1
```

`tools/clean_markup.py` reproduce las correcciones acotadas y es idempotente. No es un formateador general de HTML.

Los CSV en `docs/audit/` contienen inventario de archivos, imágenes ordenadas por peso, dependencias, referencias ausentes, sintaxis y renderizado. `reachable_from_home` significa alcanzable mediante referencias estáticas desde index; `has_static_reference` indica alguna referencia en el proyecto. No tener referencia es una candidatura, no prueba de desuso. Hay límites con JavaScript dinámico, rutas de librerías, enlaces comentados, recursos remotos y acceso directo por URL. Las referencias ausentes son candidatas que requieren interpretación, no un conteo confirmado de errores HTTP.

Resultado inicial: 108/111 PHP pasan sintaxis; 19/20 páginas GET renderizan sin diagnósticos, y services falla. No se ejecutaron endpoints de escritura. Categories y el marcador requieren una configuración de BD reproducible antes de certificar su funcionamiento.

## Orden propuesto para la modificación posterior

1. Decidir qué páginas del menú se conservarán y qué información real sustituirá a los ejemplos.
2. Definir una configuración local de BD y correo; retirar credenciales del código y cambiar las que sigan vigentes.
3. Resolver formularios, suscripción, búsqueda y categorías según las funciones que se quieran conservar.
4. Decidir si se necesita marcador en vivo; si se conserva, unificar sus APIs y añadir acceso restringido antes de habilitar escritura.
5. Revisar escritorio/móvil, galerías, slider y mapas en navegador; después retirar dependencias globales que no necesite cada página y continuar la optimización de imágenes.
