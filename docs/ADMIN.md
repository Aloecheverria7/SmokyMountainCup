# Administración — puesta en marcha local

Esta entrega añade autenticación y catálogos administrativos. No ejecuta migraciones sobre el legacy ni establece correspondencias entre sus categorías y las nuevas.

## Base y primer administrador

1. Instalar Node 24, npm y Docker. Ejecutar `npm ci`.
2. Copiar `.env.example` a `.env`. Completar `CSRF_SECRET`, `APP_DB_PASSWORD` y `MYSQL_ROOT_PASSWORD` con valores aleatorios distintos (por ejemplo, generados con `openssl rand -hex 32`). No guardar el archivo en Git.
3. Mantener la base del sistema separada de `LEGACY_DB_*`. El Compose expone MySQL 8.4 únicamente en localhost, puerto 3307 por defecto. No apunta a producción.

```sh
docker compose up -d --wait
npm run build
npm run db:migrate -w @smoky/api
npm run admin:create -w @smoky/api -- organizacion@example.com "Organización"
npm run dev
```

El último comando de creación solicita la contraseña por stdin sin mostrarla; mínimo 12, máximo 128 caracteres. No se pasa en argumentos de proceso ni hay credenciales predeterminadas. El bootstrap solo admite crear el primer administrador activo. Después se crean usuarios desde el panel. El comando de migración es explícito, repetible y no se ejecuta al arrancar la API. La reversión destructiva está deshabilitada; restaurar respaldos en un entorno separado.

Abrir `http://127.0.0.1:5173/admin/`. La configuración de Compose es para desarrollo; no es una receta de despliegue público.

## Funcionalidades

- Inicio/cierre de sesión, cambio de contraseña y comprobación de sesión actual.
- Contraseñas Argon2id y cookies HttpOnly, Secure en producción, SameSite y CSRF. Sesión opaca: la DB guarda su hash, con máximo absoluto de 24 h e inactividad de 8 h.
- Administrador y anotador. Catálogos restringidos al administrador en servidor; anotador ve su pantalla propia, sin administración. La asignación y anotación de partidos están disponibles; ver SPORTS.md.
- Nuevos usuarios y contraseñas restablecidas exigen cambio al entrar. Cambio de contraseña, cambio de permisos y desactivación revocan sesiones; la contraseña propia se cambia rotando la sesión actual.
- Crear/editar/activar/archivar temporadas. Solo una activa, con restricción de base de datos y serialización transaccional.
- Cada temporada nueva crea Infantil, Junior, Adulto y Femenino con grupos A/B, en preparación y sin equipos. No se activa automáticamente.
- Reglas configurables por competición, con valores iniciales identificados como provisionales y confirmación explícita de la organización.
- Crear/editar/archivar equipos; nombres repetidos con identidades diferentes. Inscripción única por competición, control de capacidad y bloqueo para temporadas archivadas.
- Listados paginados por cursor, versiones para detectar ediciones concurrentes y auditoría sin contraseñas ni tokens.

La landing conserva el diseño original. El sorteo publicado hace visible la competición en el centro nuevo; el feed de portada usa el sistema nuevo solo con PUBLIC_DATA_SOURCE=system. El modo legacy sigue disponible y no mezcla estadísticas. Ver [SPORTS.md](SPORTS.md).

## API implementada

Prefijo `/api/v1`. Catálogos requieren cookie de sesión de administrador. Mutaciones requieren `Origin` coincidente con APP_ORIGIN y X-CSRF-Token obtenido de `/auth/csrf`. Login devuelve datos seguros del usuario; la cookie contiene la sesión. No hay tokens de sesión en localStorage.

| Método/ruta | Comportamiento |
| --- | --- |
| POST /auth/login; GET /auth/me; POST /auth/logout | Acceso, perfil y revocación. |
| POST /auth/password | currentPassword/newPassword, rotación de sesión. |
| GET/POST /seasons; PATCH /seasons/:id | Listar/crear/editar; edición requiere expectedVersion. |
| POST /seasons/:id/activate; POST /seasons/:id/archive | expectedVersion; operación transaccional. |
| GET /seasons/:id/competitions | Cuatro competiciones y grupos A/B. |
| PATCH /competitions/:id | Reglas y expectedVersion; no admite edición publicada/archivada. |
| GET/POST /teams; PATCH /teams/:id; POST /teams/:id/archive | Gestión sin fusionar nombres repetidos. |
| GET/POST /competitions/:id/entries | Inscripciones; POST requiere teamId UUID. |
| GET/POST /users; PATCH /users/:id | Personal; cambio invalida sesiones. |
| POST /users/:id/reset-password | password/expectedVersion; exige nuevo cambio al entrar. |
| GET /audit | Registro de operaciones. |

Listados de temporadas, equipos, usuarios, inscripciones y auditoría: limit 1–100 (20 por defecto), cursor opcional; `{data:[], page:{nextCursor:null}}`. No devolver hashes internos ni errores SQL. Reglas deportivas inválidas: 422; versión o duplicado: 409; entrada inválida: 400; acceso: 401/403; DB no configurada/disponible: 503.

Las mutaciones de catálogos usan control de versión y restricciones únicas. Los comandos deportivos incorporan respuestas idempotentes persistidas y recuperación de respuestas perdidas; ver SPORTS.md. Ante conflicto de versión se requiere actualizar.

## Pruebas aisladas

```sh
npm test
npm run test:api
npm run test:admin
```

`test:admin` compila, crea un contenedor MySQL con nombre/base/credenciales aleatorios, crea el esquema anterior y un administrador por stdin, actualiza el esquema y comprueba migraciones repetibles y prueba autenticación, concurrencia, restricciones y flujos reales de navegador. El contenedor se elimina al terminar y no usa la configuración de DB del usuario. Requiere Docker y Chrome local en macOS; en Linux instalar Chromium con `npx playwright install --with-deps chromium`.

Capturas de administración quedan en artifacts (fuera de Git). La prueba visual de landing sigue disponible con LEGACY_ROOT. No se ha importado el SQL operativo ni asignado equipos reales a las nuevas competiciones.

## Selección del motor

`APP_DB_TYPE=mysql` es el valor predeterminado. Se verifican MySQL 8.0 y 8.4. Para una instalación existente de MariaDB 11.8, conservar `APP_DB_TYPE=mariadb` y usar `docker compose -f compose.mariadb.yaml up -d` con `MARIADB_ROOT_PASSWORD`. Los volúmenes de ambos motores están separados: no conectar MySQL al volumen de MariaDB. Cambiar esta variable no convierte ni migra datos existentes.

Las pruebas usan contenedores desechables: `SMC_TEST_DB_VERSION=8.0 npm run test:admin` o `SMC_TEST_DB_TYPE=mariadb npm run test:imports`; por defecto usan MySQL 8.4.
