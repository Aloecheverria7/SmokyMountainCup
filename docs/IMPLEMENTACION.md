# Implementación y comprobaciones

## Entregado localmente

- Web pública en inglés con identidad azul marino/coral, navegación mantenida, galería real y formularios de contacto, equipos y vendedores.
- Banda de resultados bajo el menú y tarjetas de partidos simultáneos, filtro de categoría, suspendidos separados, actualización compartida cada cinco segundos y recuperación de conexión. Pausa y movimiento reducido en la banda.
- Panel en español para temporadas, categorías, competiciones, equipos, inscripciones, jugadores, plantillas, sedes, canchas, usuarios y pósteres.
- Grupos, eliminación directa, asignación manual, sorteo con vista previa y confirmación, pases libres, clasificación y avances de llaves.
- Programación con validación de cancha y equipos, asignación de anotadores, reloj del servidor, goles/autogoles, autor, anulaciones, confirmación y penales separados.
- Tablas oficiales/provisionales, goleadores, detalle de partido e historial de temporadas.
- Configuración privada, permisos, CSRF, claves de operación para reintentos y registro de cambios. Las APIs antiguas de escritura devuelven 410.

La copia SQLite local conserva los 40 equipos, 24 partidos y las 158 filas originales del SQL. No hay una temporada activa nueva: se crea desde el panel. Su administrador tiene contraseña aleatoria única guardada en `storage/ACCESO_LOCAL.md`.

## Validación realizada

- 35 comprobaciones de integración en SQLite y las mismas 35 en MariaDB 10.4 aislada, incluyendo migraciones repetibles, importación histórica, grupos, pases libres, permisos, goles duplicados, estados independientes, tablas, clasificación, penales y conflictos de programación.
- 46 comprobaciones de navegador con Chrome sin ventana en escritorio y celular: portada, categorías simultáneas, banda, pósteres, desplazamiento y posición entre refrescos, pausa, movimiento reducido, imágenes, todas las vistas del panel, creación de equipos, publicación del sorteo, anotación, CSRF, desconexión/reconexión y restricciones del anotador.
- SMTP con servidor simulado en loopback: respuestas multilínea, envelope, Reply-To, cuerpo UTF-8 y rechazo de inyección de cabeceras. No se enviaron mensajes externos.
- 86/86 PHP fuera de bibliotecas y respaldos pasan sintaxis; 8/8 páginas actuales generan HTML sin diagnósticos de PHP. JavaScript nuevo verificado. Las librerías PHP antiguas de Quform quedan retiradas y bloqueadas para acceso web; no se consideran dependencias del nuevo sitio.

Las capturas de navegador se guardan en `tests/artifacts/`. Los scripts de prueba usan datos aislados, nunca las credenciales ni los resultados de producción.

## Límites y preparación de publicación

- No se ha desplegado ni modificado el hosting. Comprobar PHP 8.2+, reglas de protección del servidor, HTTPS, permisos de directorios y MySQL antes de publicar.
- SMTP requiere las credenciales del proveedor y una prueba de entrega real.
- El anotador necesita conexión para guardar; los reintentos conservan la misma operación. No hay sincronización de escrituras sin conexión.
- Las rondas posteriores ya jugadas no se eliminan automáticamente para corregir un resultado anterior. Las dependencias no iniciadas se retiran con motivo antes de reabrirlo.
- El sorteo es aleatorio simple, sin bombos; la programación de horarios es manual con validación.
- La configuración de categorías y reglas nuevas corresponde a la organización. Se conservaron las categorías históricas sin asumir las de la siguiente edición.

Consultar [INSTALACION.md](INSTALACION.md) para crear el administrador, importar datos, operar el torneo y preparar respaldo/restauración.
