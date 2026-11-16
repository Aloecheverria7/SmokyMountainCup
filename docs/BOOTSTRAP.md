# Estado de implementación — 9 de noviembre de 2026

Implementación acumulada: operación deportiva, importación reconciliada, publicación de fixtures y preparación de Hostinger. La documentación operativa está en [ADMIN.md](ADMIN.md) y [SPORTS.md](SPORTS.md).

## Implementado

- NestJS + React/Vite/TypeScript, CI, MariaDB y migraciones explícitas/versionadas. Actualización desde el esquema anterior verificada en una base desechable con usuario existente; sin sincronización ni migraciones automáticas al arrancar.
- Landing y recursos originales conservados. Cabecera, menú, galería, formularios SMTP, banda con pausa, resultados simultáneos, filtros y recuperación de conexión. Administración cargada como módulo separado.
- Autenticación admin/scorer, Argon2id, sesiones persistidas/revocables, CSRF, cambios obligatorios iniciales, usuarios y auditoría sin credenciales.
- Temporadas, reglas confirmadas, cuatro competiciones independientes A/B, equipos e inscripciones. Jugadores, nacimiento/contacto privados y plantillas con restricciones de jugador/dorsal. Sedes, canchas y archivo lógico.
- Sorteo aleatorio/manual con preview caducable, huella, publicación atómica y fixtures de grupos. Programación en UTC con zona de temporada y desambiguación horaria; conflictos de cancha/equipo entre competiciones.
- Asignación de anotadores y permisos por partido; reloj independiente del servidor; estados, goles/autogoles con autor opcional, anulación lógica y confirmación administrativa. Penales separados del marcador.
- Respuestas deportivas idempotentes persistidas, versiones y transacciones. Recuperación de operación pendiente desde sessionStorage tras perder respuesta y recargar la pestaña, sin cola de escrituras sin conexión.
- Tablas oficiales/provisionales, goleadores, clasificados con motivo de empate exacto, llaves, pases libres y avance de ganadores. Retiro protegido de rondas no iniciadas, reapertura, corrección y reconstrucción.
- Feed y centro público nuevos: temporadas publicadas, fixtures, filtros, tablas, llaves, goleadores y detalle/eventos sin datos privados. PUBLIC_DATA_SOURCE selecciona explícitamente legacy/system; no se mezclan fuentes.

## Validación ejecutada

Build y typecheck de ambas apps; 7 pruebas unitarias; 88 comprobaciones MariaDB/API; 8 pruebas de navegador; 12 comparaciones de landing sin diferencias detectadas. La prueba de recuperación pierde la respuesta HTTP después de guardar un gol, recarga la página y reintenta con la misma clave: conserva un único evento.

Las pruebas usan contenedor/DB/credenciales aleatorios y lo eliminan al terminar; no acceden a producción ni envían correo. La suite incluye upgrade desde la migración anterior con administrador existente. Las capturas de escritorio/móvil y resultados se generan en artifacts y no se versionan. Los reportes JSON de docs registran cada entrega; admin-validation-report.json corresponde a la segunda, sports-validation-report.json a la tercera.

Referencia visual PHP: commit e67ef36fcb18d0f16d64355d414788a010d5d1d9. Cuatro anchos (360/390/768/1440), tres escenarios, datos/tiempo controlados y movimiento reducido; pixelmatch threshold 0.1. No representa una certificación de todos los navegadores o estados posibles.

## Pendiente

Persistencia/subida de medios y pósteres; importación/reconciliación definitiva y correspondencias de datos legacy; contrato OpenAPI completo; despliegue/HTTPS, respaldo/restauración y prueba SMTP real. No se ha importado ni modificado la base operativa. La edición actual continúa. La distribución A/B está confirmada; fecha de corte y reglas de elegibilidad requieren confirmación; no se deducen del SQL.

La configuración de competiciones de esta edición es grupos A/B más eliminatorias. El sorteo inicial de una competición exclusivamente de eliminación directa, otros números de grupos y reglas adicionales quedan fuera de esta configuración inicial. MFA, contraseñas filtradas, recuperación autónoma y límites compartidos para varias instancias siguen pendientes del endurecimiento previo al despliegue. No se ha medido capacidad de producción ni realizado una publicación.

## Avance de reconciliación

El propietario confirmó continuar la edición actual y clasificar los grupos 6–9/10–11 en Infantil y 12–13/14–17 en Junior; Categoria A/B pertenece a Adulto y Femenil a Femenino. Se añadieron legacy:inspect y legacy:plan, sin ejecución SQL ni acceso a DB, con pruebas de parser, conservación y archivos de reporte privados. Ver RECONCILIACION.md.

La asignación A/B está confirmada: Infantil 6–9/10–11, Junior 12–13/14–17, Categoria A completa → Adulto A y Categoria B completa → Adulto B; Femenil conserva A/B. El análisis del archivo proporcionado mantiene las 158 filas y separa 21 discrepancias aritméticas de 25 filas con jugados no reconstruibles. No se corrigió ni modificó la base operativa; staging, promoción de ensayo e integración de estadísticas iniciales están implementados; corte y despliegue siguen pendientes. Las comprobaciones deportivas y visuales de la tercera entrega permanecen registradas en sports-validation-report.json; la entrega de planificación no modificó la web ni las APIs operativas.

## Lotes de importación en entorno aislado

Tercera migración: batches, registros originales con checksum, mappings, snapshots e historial de decisiones por actor/motivo/revisión. CLI stage/report/decide/promote con destino local de prueba obligatorio. Promoción atómica, repetición sin duplicar, verificación por fila y rollback ante fallos. La temporada importada se crea sin activar ni publicar y con reglas sin confirmar. La landing no cambia. Ver RECONCILIACION.md para límites y operación.

El propietario confirmó conservar las cifras actuales como base inicial revisada. La clasificación suma esa base a resultados nuevos; DG conserva la discrepancia original y suma solo diferencias nuevas. Reabrir resultados no borra la base. Sigue pendiente el nombre/reglas oficiales, ensayo final con dump reciente y corte de producción. Los actores de las pruebas no sustituyen el registro del operador en el corte.

Validación de esta entrega: build, 20 pruebas unitarias, formato, 6 smoke API, 88 comprobaciones MariaDB/API y 8 pruebas de navegador. Ensayos de importación: 29 comprobaciones con datos sintéticos y 29 con el SQL suministrado (158 filas, 40 equipos, 24 partidos, 40 snapshots). Se comprobó rollback de promoción con fallo inyectado y se eliminaron los contenedores. Resultados resumidos en [import-validation-report.json](import-validation-report.json). No se repitió comparación visual porque no cambió HTML/CSS/React.

## Publicación de importados y preparación Hostinger

Implementada publicación/ocultamiento auditado e idempotente de competiciones importadas desde Organización, con revisión de integridad y sin regenerar fixtures. Modo de alojamiento administrado: NestJS sirve el build React en el mismo origen, host/PORT/proxy configurables y readiness de DB/esquema; ZIP con manifiesto y preflight de configuración. Ensayo de respaldo/restauración privado en segunda MariaDB desechable. Ver [HOSTINGER.md](HOSTINGER.md).

El propietario confirmó plan Hostinger Business/Unlimited o Cloud con Node.js. No hay conexión autenticada a hPanel y siguen pendientes el nombre/zona oficiales y las conexiones DB/SMTP. El dominio público de referencia se confirmó posteriormente como smokymountaincup.com. El despliegue real, congelación y corte continúan pendientes; no se ejecutan migraciones/pruebas contra producción.

Validación de publicación/alojamiento: build, 22 pruebas unitarias, formato, 19 comprobaciones de hosting, 6 smoke API, 88 comprobaciones API/MariaDB, 8 pruebas de navegador nativas y 1 de publicación de importados. El SQL de 158 filas pasó 43 comprobaciones, incluidos publicación/ocultamiento, rechazo de snapshots faltantes, backup y restauración en otro contenedor. ZIP verificado contra 132 checksums de archivos; excluye SQL operativo/credenciales. [hosting-validation-report.json](hosting-validation-report.json). No se desplegó ni cambió DNS/tráfico.

Corrección de CI: la prueba de preflight ejecuta el subproceso desde su directorio temporal, sin depender del dist del checkout. Comprueba también el rechazo cuando falta el build temporal y limpia el fixture incluso si falla la prueba.

## Corrección de referencia visual — 14 de noviembre de 2026

La fuente de verdad de la landing es el sitio público https://smokymountaincup.com/ y sus subpáginas, no el PHP local rediseñado que se usó antes. La comprobación anterior contra el checkout local no valida el dominio publicado. Se restauran en React el tema, recursos y motores de animación observados en producción. Ver [PUBLIC-SITE-PARITY.md](PUBLIC-SITE-PARITY.md) para inventario de 19 páginas, recursos, diferencias corregidas y límites de las comparaciones.

Validación de la corrección pública: build/typecheck y formato; 26 pruebas unitarias; 7 comprobaciones API; 35 de hosting; 88 API/MariaDB; 11 pruebas de navegador de administración/deporte/público; 43 de importación/respaldo/restauración y su prueba de navegador. Adicionalmente, las 7 pruebas públicas pasan sobre el build de producción con CSP. La comparación con referencias originales independientes pasa 76 casos (19 páginas × 360/390/768/1440), con cero diferencias detectadas al umbral documentado. El ZIP actualizado contiene 1169 archivos verificados por checksum, sin SQL operativo ni credenciales, y ocupa aproximadamente 64.3 MiB. No se desplegó en Hostinger.

## Conexión de la landing con el panel — 15 de noviembre de 2026

La portada y las páginas deportivas originales consumen ahora GET /api/v1/public/site, una lectura consistente de la edición activa y competiciones publicadas desde la base nueva. React sustituye las regiones deportivas del HTML de referencia y conserva el tema y recursos originales. Las tablas no reutilizan datos de muestra cuando la API está vacía o falla. Clasificación oficial con base importada revisada, marcadores, plantillas, calendario, enlaces con contexto, paginación/ordenación y consulta periódica. Detalles y límites en [PUBLIC-DATA.md](PUBLIC-DATA.md).

Validación de la integración: build y typecheck, formato, 26 pruebas unitarias, 8 comprobaciones API, 35 de hosting, 91 API/MariaDB, 15 escenarios de navegador y 45 de importación/respaldo/restauración más su escenario de navegador. Las 11 pruebas públicas pasan también con el build de producción y CSP. Comparación de estilos/contenedores con el mismo DOM deportivo y recursos originales independientes: 76 casos sin diferencias detectadas, incluida geometría. Método y límites en [public-data-validation-report.json](public-data-validation-report.json). Paquete final: 1172 archivos verificados, 64.38 MiB, sin SQL operativo ni credenciales. No se desplegó ni se modificó producción.

La comprobación de hosting consume el cuerpo completo del bundle JavaScript antes de cerrar el servidor, para que una descarga grande no bloquee la salida del smoke test.

## MySQL para Hostinger — 15 de noviembre de 2026

Se selecciona `APP_DB_TYPE=mysql` por defecto; `mariadb` sigue disponible explícitamente. Compose usa MySQL 8.4 con volumen propio y conserva `compose.mariadb.yaml` para instalaciones anteriores. No hay conversión automática de volúmenes ni cambios en la base operativa. Se adaptan ensayos y respaldo/restauración a ambos clientes, sin requerir privilegios SUPER. Las verificaciones de snapshots comparan objetos JSON sin depender del orden de sus claves, preservando todos los valores originales.

MySQL 8.0 y 8.4 y MariaDB 11.8 pasan 91 comprobaciones de API y 15 pruebas de navegador por motor (una omitida por diseño); importación/restauración: 43 comprobaciones por motor y dos adicionales más una prueba de navegador en MySQL 8.4. Además: 28 unitarias, typecheck/build, 8 API smoke y 35 hosting. Ver `mysql-validation-report.json`. CI incorpora matriz adicional MySQL 8.0/MariaDB, mientras la verificación principal usa MySQL 8.4. La cuenta real de Hostinger aún requiere configuración y prueba en staging; no se ejecutó corte ni migración en producción.

## Corrección del arranque de Hostinger — 16 de noviembre de 2026

El log real mostró un fallo al cargar el addon nativo de argon2 por GLIBC_2.34 ausente. Se sustituye por Argon2id en WebAssembly (`hash-wasm` fijado a 4.12.0), sin dependencia de binarios nativos. Se conservan parámetros y formato PHC de las cuentas existentes; se verifica compatibilidad con un hash de prueba producido por node-argon2 0.45.2 antes de retirarlo. Se prueban sal aleatoria, operaciones concurrentes, contraseña incorrecta y hashes inválidos; comparación de bytes constante. No hay cambio visual ni migración de datos. El despliegue de la corrección en hPanel requiere instalación limpia y recompilación.

## Paquete independiente para detección de Hostinger — 16 de noviembre de 2026

Tras el rechazo de estructura de hPanel, el ZIP de producción deja de ser un workspace: declara dependencias de NestJS en la raíz, añade server.js y conserva internamente ambos builds. Su build valida hashes del paquete ya compilado; npm instala solo dependencias de ejecución fijadas a las versiones probadas. No se cambia el servidor, los datos ni el diseño. Se entrega configuración propia para este ZIP (Other, raíz/salida ., entrada server.js), diferenciada de la del repositorio GitHub. La aceptación real del detector no puede inferirse de una prueba local. La prueba del ZIP exacto instala dependencias de producción en Linux/GLIBC 2.31 y ejecuta las 35 comprobaciones de hosting; CI incorpora esa verificación.
