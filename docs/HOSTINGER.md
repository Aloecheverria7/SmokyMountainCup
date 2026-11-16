# Despliegue en Hostinger Node.js

El propietario confirmó un plan Business/Unlimited o Cloud con opción Node.js en hPanel. Se preparó una aplicación única: NestJS sirve la API y el build de React, conservando los recursos y rutas PHP públicas. No requiere Docker, nginx propio, VPS ni dos dominios en Hostinger.

Referencia del proveedor, consultada el 9 de noviembre de 2026: [Node.js en Hostinger](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/). El proveedor admite NestJS/Other, Node 24 y despliegue por GitHub o ZIP; los controles concretos dependen del panel. En planes administrados no se presupone que se pueda ejecutar npm por SSH.

## Preparación entregada

- `npm run build`: compila ambas apps.
- `npm start`: arranca el backend desde la raíz; usa PORT del proveedor.
- `SERVE_WEB=1`: sirve únicamente apps/web/dist, con fallback de las rutas públicas conocidas y /admin. No expone repositorio, SQL, .env ni reportes.
- `LISTEN_HOST=0.0.0.0`: escucha en la interfaz requerida por el alojamiento administrado; el desarrollo conserva loopback por defecto.
- `TRUST_PROXY_HOPS`: cantidad exacta de proxies de confianza. Verificar la cadena del proveedor antes de elegir el valor; no se admite trust proxy=true.
- `GET /api/v1/health/live`: proceso activo. `GET /api/v1/health/ready`: base accesible y tres migraciones preparadas, sin ejecutar ninguna.
- `npm run package:hostinger`: produce un ZIP privado en artifacts, con manifiesto SHA-256 por archivo y builds incluidos. No contiene SQL operativo, .env, node_modules, auditorías locales ni reportes privados.
- `npm run hostinger:preflight`: valida configuración y presencia de builds sin abrir conexión a DB ni cambiar tráfico.

## ZIP listo para Hostinger (estructura independiente)

Desde el 16 de noviembre, `npm run package:hostinger` compila y genera un paquete de producción independiente, sin workspaces. Incluye `package.json`, lockfile de dependencias de ejecución fijadas, `server.js` en la raíz y los builds de NestJS/React. No contiene fuentes de desarrollo, node_modules, SQL ni secretos. Se conserva la corrección Argon2id portable. La estructura anterior de ZIP con workspaces queda sustituida.

Para **este ZIP** seleccionar estos valores; son distintos a los del repositorio GitHub:

| Campo | Valor |
| --- | --- |
| Framework en hPanel | Other / Otro (el servidor sigue siendo NestJS) |
| Node | 24 |
| Raíz | ./ |
| Gestor | npm |
| Build | npm run build |
| Salida | . (raíz completa) |
| Entrada | server.js |
| Arranque, si se pide | npm start |

El ZIP ya trae ambas aplicaciones compiladas. Su `npm run build` comprueba los hashes de todos los archivos entregados; no recompila TypeScript ni requiere dependencias de desarrollo. Hostinger instala las dependencias de ejecución desde el lockfile. Mantener las variables privadas configuradas, especialmente SERVE_WEB=1, LISTEN_HOST=0.0.0.0, APP_ORIGIN y CSRF_SECRET. Subir archivos nuevos en lugar de reutilizar el ZIP anterior. No borrar la base ni crear otra aplicación para intentar corregir la detección.

La prueba `node scripts/test-hostinger-package.mjs RUTA_AL_ZIP` extrae el paquete en un directorio temporal y usa Docker Node 24/Bullseye para instalar únicamente dependencias de producción, verificar el manifiesto y ejecutar las 35 comprobaciones de hosting desde server.js. No accede a producción. La aceptación final del detector de hPanel debe comprobarse en la cuenta real.

## Configuración de hPanel para GitHub (repositorio de desarrollo)

Crear primero una aplicación Node.js independiente en un subdominio de staging, sin reemplazar todavía el sitio PHP. Importar el repositorio smoky-mountain-system desde GitHub o subir el ZIP entregado. Mantener la raíz del monorepo, Node 24, framework NestJS o Other si la detección automática no reconoce workspaces, build `npm run build` y arranque `npm start`, según las opciones del panel. El build necesita las devDependencies de TypeScript/Vite; si el proveedor las omite al establecer NODE_ENV, usar instalación `npm ci --include=dev` en la fase de construcción que permita el panel. El ZIP también incluye los builds; no declarar como output público la raíz del repositorio.

Configurar secretos en las variables de hPanel, nunca en Git ni en el ZIP:

| Variable | Valor/criterio |
| --- | --- |
| NODE_ENV | production |
| SERVE_WEB | 1 |
| LISTEN_HOST | 0.0.0.0 |
| PORT | El asignado por Hostinger; no forzar 3000 si el proveedor asigna otro. |
| APP_ORIGIN | https://dominio-real, sin ruta ni slash final. Debe coincidir con el origen desde el que se usa la aplicación. |
| TRUST_PROXY_HOPS | Número verificado; normalmente un proxy exige 1, pero no se deduce del nombre del plan. |
| CSRF_SECRET | Secreto aleatorio privado de al menos 32 caracteres. |
| APP_DB_TYPE | mysql |
| APP_DB_HOST / PORT / NAME / USER / PASSWORD | Base nueva MySQL y usuario propios. Para MySQL local de Hostinger Node.js: host 127.0.0.1 y puerto 3306; nombre y usuario completos con prefijo de hPanel. |
| PUBLIC_DATA_SOURCE | legacy durante validación del adaptador o system para la edición nueva publicada. Selección explícita; nunca mezcla fuentes. |
| LEGACY_DB_* | Solo si se usa el adaptador: copia aislada y usuario SELECT-only. No dar credenciales de escritura del PHP a la aplicación nueva. |
| SMTP_HOST / PORT / USER / PASSWORD / MAIL_FROM / MAIL_TO | Datos reales del correo; sin configuración, el formulario informa error y no simula éxito. |

Usar HTTPS y validar login/cookies Secure, recursos, formularios y límites por IP desde el dominio de staging. Mantener una instancia/proceso de aplicación hasta implantar límites compartidos entre instancias; las sesiones y operaciones deportivas ya persisten en DB, pero los límites HTTP siguen en memoria. La conectividad y permisos de la base y SMTP se deben comprobar en ese entorno; no se han certificado desde esta sesión.

## Base preparada y publicación de fixtures

Por instrucción del repositorio, no se ejecutan migraciones ni pruebas en producción. Preparar el esquema y lote en una DB local aislada con una exportación reciente del origen. Confirmar nombre y zona horaria oficiales antes de generar el lote definitivo. Usar las correspondencias ya aprobadas y decisiones auditadas de conservar las cifras iniciales. Crear el administrador real mediante stdin en el entorno controlado; no restaurar usuarios ni contraseñas del ensayo automatizado como cuentas operativas.

Respaldar la base nueva preparada fuera de la web y verificar su restauración aislada. En hPanel crear una base nueva separada y restaurar el respaldo preparado con el procedimiento de importación de bases del proveedor. El helper de ensayo de este repositorio se limita a contenedores desechables y no es un comando de restauración de producción. Mantener intacta la base PHP. Las credenciales del servidor de desarrollo, sesiones de prueba y cuentas sintéticas no forman parte de la entrega operativa.

En administración → Temporadas, revisar nombre/zona y confirmar reglas vigentes de cada competición. En Organización, seleccionar temporada y competición importadas, revisar grupos y clasificación, escribir motivo y elegir **Publicar datos importados**. Esto publica solo lo existente; Adulto/Femenino no reciben partidos inventados porque el SQL no los contiene. Ocultar datos importados revoca lectura pública sin borrar grupos, partidos, resultados ni snapshots. No usar un sorteo nuevo para publicar los datos anteriores.

## Corte y reversión

1. Verificar en staging readiness, login, consulta pública, publicación/ocultamiento y un ensayo de anotación sobre datos controlados. Revisar restauración antes de fijar la ventana.
2. Congelar escrituras PHP en la ventana acordada. Obtener exportación final de SQL, medios y configuración; guardar checksum y copia privada. Repetir en aislado análisis, reconciliación, promoción y verificación de ese archivo final. No reutilizar el snapshot antiguo si hubo actividad posterior.
3. Restaurar la base nueva preparada en un destino separado; no sobreescribir la operativa PHP. Configurar credenciales de runtime, nombre/zona/reglas reales, publicar las competiciones y activar la misma edición por acción explícita. Verificar conteos contra el manifiesto antes del cambio.
4. Apuntar dominio/tráfico a la aplicación Node preparada, con APP_ORIGIN correcto y PUBLIC_DATA_SOURCE=system. Mantener el PHP sin escrituras. Verificar públicamente readiness, login, formularios y lectura sin ejecutar pruebas destructivas en producción.
5. Antes de abrir escrituras, se puede revertir tráfico al PHP y su respaldo coherente. Después de aceptar operaciones en NestJS, congelar escrituras y reconciliar esas operaciones antes de volver: restaurar una copia anterior sin reconciliarlas perdería actividad.

No hay corte ni cambio DNS automatizado. Para ejecutar la configuración real faltan dominio, acceso autorizado a hPanel, nombre/zona oficiales, reglas vigentes, conexiones DB/SMTP y ventana de congelación. No enviar contraseñas ni claves privadas por chat.

## Landing conectada al panel

La landing utiliza GET /api/v1/public/site desde la base nueva APP_DB_*. Para mostrar sus datos deben existir una temporada activa y competiciones publicadas. PUBLIC_DATA_SOURCE sigue seleccionando la fuente de otras rutas de compatibilidad, pero no desvía esta proyección hacia el SQL antiguo. La portada no utiliza datos de muestra cuando la base falta: mostrará indisponibilidad. Ver [PUBLIC-DATA.md](PUBLIC-DATA.md).

## MySQL de Hostinger

El sistema usa MySQL por defecto y dispone de validación aislada para MySQL 8.0 y 8.4: migraciones, panel, lectura pública, importación y respaldo/restauración. MariaDB 11.8 continúa disponible mediante selección explícita. No se requiere instalar MariaDB en Hostinger. Consultar la versión real de MySQL en hPanel antes del despliegue; el acceso y despliegue reales aún no se han ejecutado. Crear una base nueva y preparar su esquema/datos con el procedimiento de reconciliación: el SQL PHP original no es el esquema de NestJS.

Referencia: [conectar MySQL con Node.js en Hostinger](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/). No usar `localhost` en esa conexión local: el proveedor indica `127.0.0.1`.

## Error de arranque GLIBC_2.34 (16 de noviembre de 2026)

El registro de Hostinger identificó `argon2/prebuilds/linux-x64/argon2.glibc.node` como causa del cierre del proceso: su binario requería GLIBC_2.34, ausente en el alojamiento. Se elimina el addon nativo y se utiliza `hash-wasm` 4.12.0 (WebAssembly) para Argon2id. Se mantienen formato PHC, sal aleatoria de 16 bytes, hash de 32 bytes y parámetros m=19456,t=2,p=1. La verificación conserva hashes de la implementación anterior y compara bytes mediante timingSafeEqual. No modifica cuentas, esquema ni datos.

Para aplicar: desplegar la última versión de `main`, ejecutar instalación limpia con `npm ci --include=dev` y build `npm run build`, conservando las variables privadas existentes. Si hPanel permite limpiar caché de dependencias, usar esa opción para evitar reutilizar el addon antiguo. Reiniciar sin reinstalar dependencias no aplica la corrección. Mantener entrada `apps/api/dist/main.js`, Node 24 y raíz `./`. No actualizar GLIBC ni importar otra vez la base. Verificar `/api/v1/health/live` y después `/api/v1/health/ready`; el segundo puede seguir dando 503 si faltan conexión o migraciones.
