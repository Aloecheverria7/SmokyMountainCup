# Operación deportiva — tercera entrega

Implementa plantillas, sedes/canchas, sorteos de grupos, calendario, anotación, clasificación y eliminatorias en la base nueva. No importa ni modifica la base operativa legacy.

## Actualizar una instalación anterior

```sh
npm ci
npm run build
npm run db:migrate -w @smoky/api
npm run dev
```

La migración `Sports1794225700000` amplía la primera entrega sin reemplazar sus tablas, usuarios o temporadas. La suite crea primero el esquema anterior y su administrador, y luego aplica la ampliación dos veces para verificar actualización y repetibilidad. No hay migraciones automáticas al arrancar ni rollback destructivo.

## Preparación y jornada

1. Crear temporada e inscribir equipos en Infantil, Junior, Adulto y Femenino. Cada competición conserva grupos A/B independientes.
2. Configurar y confirmar explícitamente sus reglas desde Temporadas: duración, capacidad, puntos y plazas clasificatorias. Los valores iniciales no se consideran reglamento confirmado.
3. Crear jugadores en Jugadores; seleccionar temporada, competición y equipo para añadirlos a la plantilla con dorsal. Nacimiento/contacto son privados. Edad y fecha de corte no se deducen de los nombres de categoría.
4. Crear sedes y canchas. Archivar una sede bloquea nuevas programaciones de sus canchas sin borrar resultados anteriores.
5. Desde Organización, generar vista previa aleatoria o manual. El orden manual alterna A/B; cada inscripción aparece una vez. La publicación crea una vuelta todos contra todos por grupo y hace pública la competición.
6. En Partidos, seleccionar y abrir un encuentro; definir fecha/hora en la zona de temporada, cancha y anotador. Ante una hora que ocurre dos veces por cambio estacional, elegir la opción con su desfase; una hora inexistente se rechaza.
7. Administrador o anotador asignado inicia/pausa/finaliza el partido y registra goles/autogoles. El autogol se asigna al equipo del autor y suma al rival. Autor opcional; anulación lógica con motivo, sin borrar el evento.
8. El administrador confirma el resultado final. Solo los resultados confirmados alimentan la tabla oficial y los goleadores. Los penales resuelven una eliminatoria empatada y se almacenan aparte del marcador.
9. Una vez confirmados todos los partidos de grupos, seleccionar clasificados y orden de cruces en Organización. Se validan cupos y criterios deportivos; el empate exacto requiere motivo, sin usar el nombre como criterio de clasificación.
10. Los ganadores confirmados y pases libres avanzan por las llaves. Para corregir un resultado con dependencias, retirar primero las rondas posteriores no iniciadas, reabrir, corregir, confirmar y reconstruir. Las rondas iniciadas no se borran.

Un suspendido puede reprogramarse antes de reanudarlo. Retomar un suspendido con conflicto horario requiere ajustar primero su programación. Una temporada con partidos pendientes de finalizar/confirmar no se archiva, para evitar bloquear una jornada operativa por accidente.

## Concurrencia y recuperación

Las operaciones deportivas requieren `Idempotency-Key` (16–80 caracteres seguros) y `expectedVersion` cuando modifican un agregado existente. La publicación de sorteo usa la huella y caducidad de su preview.

- Mismo actor, operación, entidad, clave y payload: devuelve la respuesta original, aunque la versión haya avanzado.
- Clave reutilizada con otro payload/entidad/actor: 409.
- Clave nueva con versión obsoleta: 409, sin sobrescribir cambios de otro dispositivo.
- Evento, marcador, auditoría y respuesta idempotente se guardan en una transacción.
- Un mutex transaccional compartido serializa las escrituras deportivas y de catálogos. Así se validan conflictos de equipos y canchas entre competiciones. Es una decisión para esta primera versión; no se ha certificado carga a gran escala.

El panel guarda la operación pendiente en sessionStorage, separada por usuario y partido/competición. Si se pierde la respuesta, bloquea nuevas escrituras de ese ámbito y ofrece reintentar exactamente la misma operación. Sobrevive a recargar la pestaña. No almacena tokens de sesión ni implementa una cola de anotación sin conexión.

El reloj usa segundos persistidos más tiempo del servidor solo cuando está en juego; cada partido es independiente. Refrescar o pausar no reinicia acumulados. Las respuestas con una versión anterior se descartan en el editor. El listado y el detalle se actualizan periódicamente.

## Datos públicos: elección explícita

`PUBLIC_DATA_SOURCE=legacy` es el valor por defecto y conserva el feed de lectura de la base original. No se cambia automáticamente al crear una temporada ni se mezclan sus estadísticas con las nuevas.

Para una instalación de prueba o edición nueva deliberadamente preparada en el sistema:

```dotenv
PUBLIC_DATA_SOURCE=system
```

Con esa configuración, el feed usa únicamente competiciones publicadas de la temporada activa. El centro público permite consultar otras temporadas publicadas, fixtures con filtros de fecha/estado, clasificación oficial/provisional, llaves, goleadores y detalle/eventos. No publica fecha de nacimiento, contacto, asignación de anotador ni eventos anulados. Los borradores no son consultables por ID.

No activar esta configuración sobre la operación real hasta completar nombre de la edición actual y reconciliación de estadísticas; la continuidad de edición, las competiciones y la distribución A/B de origen ya están confirmadas. No se ha importado ningún dato operativo en esta entrega. El modo legacy mantiene su vista de lectura previa.

## API añadida

Prefijo `/api/v1`. Catálogos y organización: administrador, sesión y CSRF. Partidos: administrador o anotador asignado, con cambio de contraseña inicial completado. Los comandos deportivos usan Idempotency-Key.

| Método y ruta | Operación |
| --- | --- |
| GET/POST /players; PATCH /players/:id; POST /players/:id/archive | Datos privados de jugadores. |
| GET/POST /entries/:id/roster; PATCH /rosters/:id | Plantilla y dorsal; no reasigna identidad. |
| GET/POST /venues; PATCH /venues/:id; POST /venues/:id/archive | Sedes. |
| GET/POST /fields; PATCH /fields/:id; POST /fields/:id/archive | Canchas. |
| GET /competitions/:id/sport-state | Estado y tablas para organización. |
| POST /competitions/:id/draw-previews | mode random/manual, entryIds opcional. |
| POST /competitions/:id/draw | previewId; publica fixtures. |
| POST /competitions/:id/reset-draw | expectedVersion/reason; solo no iniciados y sin programación. |
| POST /competitions/:id/qualify | expectedVersion/entryIds ordenados/tieReason si procede. |
| POST /competitions/:id/remove-rounds; POST /competitions/:id/rebuild-rounds | Corrección auditada de rondas. |
| GET /matches; GET /matches/:id | Lista paginada por seasonId/competitionId y detalle autorizado. |
| PATCH /matches/:id/schedule | expectedVersion, fieldId y scheduledAt ISO con desfase; null retira asignación/horario. |
| POST /matches/:id/assignment | expectedVersion/scorerId nullable. |
| POST /matches/:id/status | expectedVersion/status. |
| POST /matches/:id/events | expectedVersion/entryId/rosterId?/kind/minute. |
| POST /matches/:id/events/:eventId/void | expectedVersion/reason. |
| POST /matches/:id/confirm; POST /matches/:id/reopen | Confirmación con penales si procede / reapertura motivada. |
| GET /public/seasons; GET /public/seasons/:id/competitions | Catálogo publicado. |
| GET /public/competitions/:id/matches | Paginación, filtros date/status. |
| GET /public/competitions/:id/standings?mode=official\|provisional | Tablas por grupo. |
| GET /public/competitions/:id/bracket; GET .../scorers | Llaves y goleadores. |
| GET /public/matches/:id | Marcador y eventos visibles. |

## Validación ejecutada

- Build/typecheck de ambas apps; 7 pruebas unitarias, incluyendo todas las llaves de 2 a 512 entradas y cambios estacionales de horario.
- 88 comprobaciones de API/MariaDB: actualización de esquema, aislamiento por competición, permisos, dorsales, conflictos concurrentes, goles duplicados, autogoles/anulaciones, confirmaciones, empates motivados, pases libres y corrección de llaves.
- 8 pruebas de navegador: incluyen preparación deportiva, programación, pérdida de respuesta de un gol, recarga/reintento sin duplicación y centro público real.
- 12 comparaciones de landing PHP/React sin diferencias detectadas, con datos/tiempo controlados y movimiento reducido.

`npm run test:admin` crea y elimina su contenedor/DB/credenciales desechables. No utiliza producción ni envía correo real. Las capturas quedan en artifacts, fuera de Git. La publicación real, la migración/reconciliación definitiva, los medios/pósteres y el OpenAPI completo siguen pendientes.

## Publicación de competiciones importadas

Organización muestra los datos importados sin ofrecer un nuevo sorteo. Publicar/Ocultar exige motivo, versión y clave de operación; publica únicamente registros existentes y conserva sus identidades. El endpoint POST /api/v1/competitions/:id/imported-publication recibe expectedVersion, published y reason. Requiere administrador, sesión y CSRF; al publicar comprueba reglas confirmadas y origen/snapshots íntegros. El retiro oculta consulta pública sin borrar ni detener por sí solo la operación deportiva.
