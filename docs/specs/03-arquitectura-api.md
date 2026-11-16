# 03 — Arquitectura y contrato de API

## Decisiones propuestas

Backend NestJS/TypeScript como monolito modular y frontend React/TypeScript. Usar MySQL 8.0/8.4 (o MariaDB 11.8 explícito) con InnoDB/utf8mb4; crear esquema nuevo, sin sustituir tablas originales. No se fija una versión mayor de Node, Nest o React en estas SPECS: al iniciar implementación, seleccionar versiones soportadas compatibles y fijarlas en lockfile e imagen de despliegue.

Propuesta frontend: React Router con Vite, con prerender de páginas informativas y CSR para panel y marcador; si SEO de cada partido/competición es requisito, elegir renderizado de servidor del framework antes de construir rutas. React recomienda iniciar con un framework y contempla React Router; la decisión concreta de renderizado responde a este proyecto ([documentación oficial](https://react.dev/learn/creating-a-react-app)). Toda lógica deportiva y acceso a DB reside en NestJS. La elección de herramientas no autoriza cambios visuales: la landing React debe conservar íntegramente el diseño y la funcionalidad del PHP actual conforme RF-11A. Componentizar y sustituir plugins solo cuando se mantenga el resultado observable.

Propuesta de persistencia: TypeORM con migraciones versionadas, sin sincronización automática de esquema en producción. Repositorios por módulo, sin consultas desde componentes React. Contratos OpenAPI como fuente para cliente TypeScript generado; las especificaciones siguientes son el contrato preliminar, no un OpenAPI completo.

```text
apps/
  api/src/modules/{auth,seasons,categories,competitions,teams,players,
                   venues,draws,matches,standings,content,inquiries,audit,imports}
  web/src/{routes,features,components,api}
packages/
  api-client/     # generado a partir del contrato
  config/        # configuración compartida de herramientas
```

Sesiones opacas persistidas en servidor, cookie HttpOnly/Secure/SameSite=Lax, despliegue web/API bajo mismo origen. CSRF y comprobación Origin para mutaciones. No almacenar tokens en localStorage. Sesión con inactividad propuesta de 8 horas y máximo absoluto de 24 horas; revocación inmediata por cambio de contraseña, rol o desactivación. Recuperación inicial por administrador; recuperación autónoma por email queda fuera hasta definir proveedor y flujo.

## Responsabilidades

| Módulo | Responsabilidad |
| --- | --- |
| Auth | Usuarios, sesiones, rate limit y permisos. |
| Seasons/Categories/Competitions | Configuración y condiciones de edición. |
| Teams/Players | Inscripciones, plantillas, identidad y privacidad. |
| Venues | Sedes y canchas. |
| Draws | Preview, publicación, clasificación y grafo de llaves. |
| Matches | Agenda, asignación, estados, reloj, eventos y confirmación. |
| Standings | Proyecciones oficiales/provisionales y goleadores. |
| Content/Inquiries | Medios, pósteres, páginas y consultas/correo. |
| Audit/Imports | Trazabilidad y migración restringida por CLI. |

Polling como transporte inicial: suficiente para paridad, ya utilizado por PHP. SSE queda como evolución si mediciones justifican menor latencia. No incorporar microservicios, broker o Redis como requisitos iniciales. Una tabla de outbox y worker del mismo servicio bastan para correo durable si se aprueba D-06.

## Convenciones HTTP

Prefijo `/api/v1`. JSON camelCase; IDs nuevos UUID, opacos al cliente. UTC ISO 8601 con `Z`; nacimiento como `YYYY-MM-DD`. GET paginado con cursor y limit (20 por defecto, 100 máximo), orden estable con ID como desempate. Filtros validados y documentados; ninguna ruta recibe nombres libres de tabla/columna. GET públicos solo datos publicados.

Validación global de DTO con whitelist y rechazo de propiedades desconocidas; Nest documenta estas opciones en [ValidationPipe](https://docs.nestjs.com/techniques/validation). Respuestas públicas usan DTO propios, no serialización directa de entidades.

Respuesta de colección: `{ "data": [], "page": { "nextCursor": null } }`. Respuesta individual: `{ "data": {} }`. Error: `{ "error": { "code": "MATCH_VERSION_CONFLICT", "message": "El partido cambió; actualiza antes de continuar", "requestId": "...", "details": { "currentVersion": 8 } } }`.

Estados: 400 JSON/formato inválido; 401 sin sesión; 403 sin permiso; 404 inexistente/no publicado; 409 conflicto de versión, clave o unicidad; 422 regla deportiva; 429 límite; 503 dependencia indisponible. POST crea con 201; comandos con 200; logout 204. No devolver SQL, stack o configuración.

## Rutas mínimas

Todas requieren admin salvo las marcadas públicas, sesión o anotador.

| Método y ruta | Acceso y contrato principal |
| --- | --- |
| GET /auth/csrf | Público; token asociado a sesión inicial. |
| POST /auth/login | Público + CSRF; email/password; crea cookie y rota sesión. |
| POST /auth/logout; GET /auth/me | Sesión; revoca / devuelve usuario mínimo. |
| POST /auth/password | Sesión; currentPassword/newPassword; revoca otras sesiones. |
| GET/POST /users; PATCH /users/:id | Admin; cuentas, roles y estado; nunca retorna hash. |
| POST /users/:id/reset-password | Admin; contraseña temporal por canal privado, revocación y cambio obligatorio propuestos. |
| GET /public/seasons; GET /public/seasons/:id/competitions | Público; solo información visible. |
| GET /public/live?competitionId=... | Público; filtro real de partidos, serverTime, snapshotVersion, pósteres vigentes. |
| GET /public/competitions/:id/matches | Público; filtros date/status y paginación. |
| GET /public/competitions/:id/standings?mode=official\|provisional | Público; grupos, criterio y procedencia. |
| GET /public/competitions/:id/bracket; GET .../scorers | Público; llaves / goleadores. |
| GET /public/matches/:id | Público; marcador, reloj, versión, confirmación y eventos públicos. |
| GET /public/content; GET /public/gallery | Público; contenido publicado y medios permitidos. |
| POST /public/inquiries | Público + CSRF/rate limit; kind contact/team/vendor y campos de RF-12. |
| GET/POST /seasons, /categories, /teams, /players, /venues, /fields, /competitions | Admin; crear/listar recursos separados, no endpoint SQL genérico. |
| PATCH /{recurso}/:id | Admin; solo recursos anteriores, campos permitidos y versión. |
| POST /seasons/:id/activate; POST /{recurso}/:id/archive | Admin; comando transaccional; archive solo en recursos archivables. |
| GET/POST /competitions/:id/entries | Admin; inscripción existente no se reasigna. |
| GET/POST /entries/:id/roster; PATCH /rosters/:id | Admin; jugador/dorsal, edición de dorsal. |
| POST /competitions/:id/draw-previews | Admin; mode y entryIds ordenados; retorna previewId, expiresAt, fingerprint y fixtures. |
| POST /competitions/:id/draw | Admin; previewId/fingerprint; publica; Idempotency-Key. |
| POST /competitions/:id/reset-draw | Admin; reason y expectedVersion; retira solo fixtures válidos. |
| POST /competitions/:id/qualify | Admin; orderedEntryIds, tieDecisions con reason; Idempotency-Key. |
| POST /competitions/:id/remove-rounds; POST .../rebuild-rounds | Admin; fromRound/reason/expectedVersion según operación. |
| GET /matches; GET /matches/:id | Admin o anotador solo asignados; plantillas/eventos mínimos. |
| PATCH /matches/:id/schedule | Admin; fieldId/scheduledAt nullable, expectedVersion. |
| PUT /matches/:id/assignment | Admin; scorerId nullable, expectedVersion. |
| POST /matches/:id/status | Admin/anotador asignado; status/expectedVersion. |
| POST /matches/:id/events | Admin/anotador asignado; tipo/equipo/jugador/minuto/expectedVersion. |
| POST /matches/:id/events/:eventId/void | Admin/anotador; reason/expectedVersion. |
| POST /matches/:id/confirm | Admin; expectedVersion y penales cuando aplique. |
| POST /matches/:id/reopen | Admin; reason/expectedVersion. |
| GET/POST /posters; PATCH /posters/:id; POST /media | Admin; media devuelve ID, nunca ruta arbitraria. |
| GET /audit; GET /imports/:id/report | Admin; paginado y sin secretos. |
| GET /inquiries; PATCH /inquiries/:id | Propuesta D-06; admin; estado de atención separado de entrega de correo. |

El OpenAPI de implementación debe expandir cada familia en operaciones concretas, con schemas completos, ejemplos, permisos, límites y errores; esta notación de familias no será una ruta literal.

Ejemplo de gol:

```http
POST /api/v1/matches/UUID/events
Idempotency-Key: UUID
X-CSRF-Token: TOKEN
Content-Type: application/json

{"expectedVersion":7,"kind":"goal","entryId":"UUID","rosterId":null,"minute":18}
```

Respuesta 201: `{ "data": { "eventId": "UUID", "matchId": "UUID", "version": 8, "score": { "home": 1, "away": 0 } } }`.

## Consistencia obligatoria

1. Todas las mutaciones deportivas reciben Idempotency-Key y expectedVersion de la entidad agregada. Reintento exacto devuelve respuesta original, aunque la versión ya avanzó. Misma clave con cuerpo/ruta/actor distintos: 409. Retener claves deportivas durante toda la temporada y su archivo.
2. Dentro de transacción: comprobar permiso vigente, buscar clave y comparar hash canónico, bloquear agregado, validar versión/regla, persistir cambios y auditoría, guardar respuesta idempotente y confirmar. Nunca dejar gol sin marcador o confirmación sin avance de ganador.
3. Programación bloquea recursos compartidos de cancha/equipo en orden determinista y vuelve a consultar solapamientos dentro de transacción. Un bloqueo por partido solamente no evita conflictos entre partidos diferentes.
4. Sortear/clasificar bloquea la competición y verifica huella. Restricciones únicas evitan doble asignación a grupo, doble ronda/posición y doble inscripción.
5. Correo se envía fuera de transacciones deportivas. Si hay outbox, fallo SMTP no revierte una consulta ya recibida.
6. Snapshot público coherente; versiones monotónicas para descartar respuestas antiguas. Datos oficiales y provisionales deben proceder del mismo corte de lectura.

## Requisitos no funcionales propuestos

- HTTPS, SQL parametrizado, contraseña Argon2id, antiabuso por cuenta/IP con mensajes neutros; límites configurables. Mantener al menos la longitud actual de 12–128 caracteres, permitir gestores y bloquear contraseñas comunes.
- Medios fuera del código ejecutable, validación de firma/dimensiones, sin SVG o HTML subido en V1, eliminación de metadatos al procesar imágenes. Solo activos publicados accesibles públicamente.
- Logs estructurados con requestId, duración, ruta y código; métricas de errores, conflictos, latencia y cola de correo. `/health/live` sin dependencias y `/health/ready` con DB; acceso sin detalles sensibles.
- Objetivos de ensayo, no mediciones: 500 lectores concurrentes y 20 anotadores; GET público p95 <500 ms y mutación p95 <800 ms sin tiempo SMTP; actualización visible en <=7 s en red estable. Validar en infraestructura elegida antes de prometer capacidad.
- Backups cifrados, ensayo de restauración y objetivos propuestos RPO 15 min/RTO 2 h, pendientes de presupuesto/proveedor.
- Interfaz usable desde 360 px, teclado y foco visibles, contraste adecuado, estado comunicado por texto, movimiento reducido y controles de pausa. Estos son criterios de producto; el diseño visual detallado se hará después.

## Proyección de la landing implementada — 15 de noviembre de 2026

GET /api/v1/public/site entrega temporada activa, competiciones publicadas, grupos, clasificación oficial, partidos y plantillas públicas desde la base nueva en una lectura consistente. No devuelve datos personales privados ni decisiones de importación. La landing consulta esta proyección cada cinco segundos; las fichas de partido usan además el endpoint público por ID. Vacío/error no activa un respaldo con los datos de muestra del tema. Ver [PUBLIC-DATA.md](../PUBLIC-DATA.md).
