# 04 — Modelo de datos y migración

## Modelo destino propuesto

UUID para claves nuevas; FK explícitas; timestamps UTC con precisión consistente; fechas civiles como DATE; booleanos y enums validados. Entidades editables llevan version, createdAt y updatedAt. Catálogos con archivedAt cuando proceda; no hacer borrado en cascada de información deportiva.

| Entidad | Campos y restricciones principales |
| --- | --- |
| seasons | name, timezone, active, archivedAt; exclusividad activa transaccional. |
| categories | name, minAge?, maxAge?, archivedAt; nombre no define identidad. |
| competitions | seasonId, categoryId, format, puntos, durationMinutes, groupCount, groupCapacity, qualifiers, publishedAt?, dataOrigin; UNIQUE(seasonId,categoryId). |
| teams | name, crestMediaId?, archivedAt; nombre no único. |
| entries | competitionId, teamId; UNIQUE(competitionId,teamId). |
| players | name, birthDate?, contact?, archivedAt; datos privados. |
| rosters | entryId, playerId, competitionId, number; UNIQUE(entryId,playerId), UNIQUE(entryId,number), UNIQUE(competitionId,playerId); verificar coherencia entry/competition con FK compuesta. |
| venues / fields | sede con dirección; cancha con venueId/name; archivables. |
| groups / group_entries | group competitionId/name único dentro de competición; membresía con competitionId y FK coherentes; UNIQUE(competitionId,entryId) para un solo grupo por inscripción. |
| matches | competitionId, groupId?, stage, roundNo, positionNo, homeEntryId?, awayEntryId?, fieldId?, scheduledAt?, status, elapsedSeconds, clockStartedAt?, homeScore, awayScore, penalties?, confirmedAt?, winnerEntryId?, sourceHomeId?, sourceAwayId?, version, dataOrigin, legacyNote?. |
| match_events | matchId, authorEntryId, rosterId?, kind, minute, createdBy, createdAt, voidedAt?, voidedBy?, voidReason?; sin borrado físico de goles. |
| assignments | matchId único, userId; se asigna usuario activo con rol scorer. |
| users / sessions | usuario/email normalizado único/hash/rol/active/authVersion; sesión con token hash, caducidad y revocación. |
| idempotency_requests | clave única, actorId, method/path, payloadHash, aggregateId, responseStatus/body, createdAt. |
| draw_previews | competitionId, actorId, snapshot/fingerprint, expiresAt, consumedAt?. |
| media / posters | ruta interna generada/hash/MIME/dimensiones; poster con alt, orden, enlace y ventana de publicación. |
| audit_log | actor, acción, entidad/ID, fecha, motivo, cambios permitidos; append-only para aplicación. |
| import_batches / legacy_records / legacy_mappings | hash del origen, versión de importador, estado; payload original por tabla/PK; vínculo inequívoco con entidad/ID destino. |
| legacy_stats_snapshots | sourceTeamId, teamId, scopeId?, métricas originales, procedencia y estado de reconciliación; no sobrescribir con cálculos. |
| inquiries / mail_outbox | Propuesta D-06: tipo/payload privado/estado atención; outbox con intentos, próxima ejecución y resultado del proveedor. |

Restricciones adicionales: home != away cuando ambos existen; marcadores/segundos/minutos no negativos; participantes y grupos pertenecen a la competición; autor de evento pertenece al partido; ganador es participante. Llaves sin ciclos y fuentes de ronda anterior. UNIQUE(competitionId,roundNo,positionNo) solo para knockout mediante clave/esquema adecuado; no aplicarlo a todos los partidos de grupos, que hoy comparten roundNo=0/positionNo=0.

Índices: matches(competitionId,status,scheduledAt,id), matches(fieldId,scheduledAt), entries(teamId,competitionId), match_events(matchId,voidedAt,minute,id), assignments(userId,matchId), audit_log(createdAt,id), sessions(tokenHash), legacy_records(batchId,sourceTable,sourceId), inquiries(createdAt,id). UNIQUE en legacy_records y mappings incluye batch/origen; no usar solo nombre de tabla/ID entre dumps distintos.

## MIG-01 — Fuente operativa confirmada

El propietario confirmó el 9 de noviembre de 2026 que `u460493799_smokyOriginal.sql`, con siete tablas y 158 filas, es la base operativa actual. La migración se diseña sobre esta fuente; no depende de una exportación adicional de tablas `cup_*`. Las capacidades PHP sobre esas tablas se consideran referencia funcional para la nueva implementación.

Importar las 158 filas y ampliar el modelo sin inventar usuarios, jugadores, goles ni ediciones. Los datos se tratan como operativos: no aplicar automáticamente la decisión del importador PHP de convertirlos en “Historical import” de solo lectura. El propietario confirmó que se continúa la edición actual y se reconcilian sus datos; no se crea una nueva ni se archiva la actual. Antes de publicar, confirmar su nombre oficial y las resoluciones estadísticas. Preparar primero staging de revisión, conservando estados, identidades, estadísticas y procedencia.

En el ensayo final y el corte se obtendrá una exportación reciente de esta misma base para incorporar cambios posteriores al dump analizado. Comparar esquema y conteos contra el baseline; cualquier diferencia se incorpora al reporte y a los mappings antes de promover el lote.

## MIG-02 — Preservación y análisis

Guardar dump y manifiesto con SHA-256, fecha, tamaño y procedencia fuera de web pública. Importar en copia aislada; no ejecutar SQL arbitrario recibido por HTTP. Usar restauración controlada o parser probado del formato conocido. Cotejar FK, duplicados, nulos, estados, codificación y conteos antes de transformar. Conservar cada fila original íntegra.

Baseline de este archivo: categories=4, groups=10, teams=40, group_teams=40, games=24, goals=0, team_stats=40; total=158. Hay 21 anomalías aritméticas en 21 filas (20 diferencias de goles y un total de jugados). El archivo JSON adjunto enumera las claves afectadas. No se ha certificado integridad de una base distinta del archivo suministrado.

## MIG-03 — Transformación de las siete tablas

| Origen | Destino y política |
| --- | --- |
| categories | Preservar originales. Confirmado: Categoria A/B → Adulto; Femenil → Femenino; grupos Juvenil de 6–9/10–11 → Infantil y 12–13/14–17 → Junior. No convertir esto en una regla automática de elegibilidad sin fecha de corte. |
| groups | Estructura destino confirmada: grupos A y B dentro de Infantil, Junior, Adulto y Femenino (ocho grupos). El dump tiene diez grupos. Mapeo confirmado: 6–9 → Infantil A, 10–11 → Infantil B, 12–13 → Junior A, 14–17 → Junior B; toda Categoria A → Adulto A y toda Categoria B → Adulto B; Femenil conserva A/B. Preservar los diez grupos originales como procedencia sin fusionar equipos ni descartar registros. |
| teams | Un equipo por ID original, conservando nombre Unicode exacto. |
| group_teams | Inscripción por competición/equipo y membresía de grupo. Detectar múltiples grupos antes de aplicar restricciones nuevas. |
| games | Partido con participantes resueltos por inscripciones, grupo solo si común inequívoco; mantener marcador/estado y campos originales en snapshot. |
| goals | Eventos solo si existen y son válidos; este dump no aporta filas. |
| team_stats | Snapshot original asociado a equipo/alcance validado; nunca fuente autoritativa de estadísticas nuevas. |

Estado conocido `not started` → scheduled. Para otros dumps: `in progress` → live, `half-time` → half_time, paused → paused, ended/finished → finished. Estado desconocido se pone en cuarentena; no usar scheduled silenciosamente. No reactivar relojes antiguos al importar: conservar estado original como procedencia y exigir validación del operador antes de admitirlos como activos.

`current_minute * 60` es estimación de tiempo legacy, no precisión de segundos. `last_update` se conserva como dato de origen, nunca como scheduledAt ni clockStartedAt. `field` se mapea por etiqueta, sin inventar dirección; si se crea una sede contenedora, etiquetarla como importada y pendiente de completar.

Ambos equipos deben compartir una competición inequívoca. Si hay ambigüedad o FK huérfana, conservar registro en staging y emitir incidencia, sin descartar ni asignar una categoría arbitraria. La promoción falla hasta resolver incidencias bloqueantes.

## MIG-04 — Resultados y estadísticas incompatibles

Separar `legacy_snapshot` de `native_events` como procedencia. Un partido nuevo se calcula exclusivamente desde eventos. Un partido importado conserva marcador original aunque no existan eventos que lo justifiquen, con advertencia; no generar goles ficticios. Antes de permitir anotación sobre ese partido, establecer una política validada de reconciliación que impida que un recálculo borre el marcador base. El CLI actual solo promueve partidos sin iniciar, cero a cero y sin goles; los demás quedan en staging. Las ediciones de ensayo quedan sin activar/publicar automáticamente.

En este dump los 24 marcadores son cero y los estados pendientes, pero team_stats contiene actividad en equipos sin partidos correspondientes y en algunos juveniles. No hay historial suficiente para reconstruir clasificación oficial. El propietario confirmó conservar las cifras actuales como base inicial revisada y sumar los resultados nuevos. La clasificación oficial/provisional y las eliminatorias usan esa base más los partidos nuevos elegibles, sin inventar partidos faltantes. Cada métrica se suma de forma independiente, incluida DG; no se corrigen PJ ni DG originales por recalcular otras columnas. La API expone procedencia y baseline. Los goleadores solo usan eventos identificados nuevos. Toda corrección preserva valor original, nuevo valor, motivo y actor.

## MIG-05 — Repetibilidad y aceptación

Implementados: `legacy:inspect` y `legacy:plan`, herramientas de lectura de archivo y reporte local sin conexión a DB ni ejecución SQL. También están implementados stage/report/decide/promote en CLI exclusivamente para DB aislada, con revisión auditada, promoción atómica y verificación de origen/destino. No hay API pública de importación ni habilitación de producción. El plan conserva filas originales, propuestas derivadas y resoluciones pendientes; nunca corrige automáticamente. Mismo SHA, mapping y versión de transformación no duplica entidades. La promoción inicial exige destino deportivo vacío; no importa deltas sobre una base poblada. Importación fallida deja batch fallido y no publica entidades incompletas; promoción atómica del lote validado. Restaurar backup en DB aislada debe ser parte del ensayo.

Aceptación obligatoria:

- Las 158 filas están preservadas, incluidos los 40 snapshots de estadísticas y los IDs repetidos por nombre.
- Los 24 partidos se resuelven sin pérdida; cualquier excepción aparece en reporte con tabla/PK/motivo.
- Reporte antes/después con conteos de origen, creados, vinculados y en cuarentena; ninguna pérdida silenciosa.
- scheduledAt permanece null cuando no hay horario real; no se usa 2024 ni 2026 como edición por inferencia.
- Reejecutar no cambia conteos ni resultados. Auditoría y mappings permiten rastrear cada entidad al origen.
- Acentos y nombres exactos conservados; medios copiados con manifiesto y referencias verificadas.

## MIG-06 — Corte y reversión

Ensayo completo en staging con exportación reciente, revisión del organizador y restauración verificada. En corte: congelar escrituras PHP, respaldar SQL/medios/configuración, importar delta o snapshot final, verificar, cambiar tráfico, ejecutar smoke de lectura/login/anotación en edición controlada. Un solo sistema escribe en cada momento.

Reversión antes de abrir escrituras nuevas: volver tráfico a PHP y backup coherente. Si Nest ya aceptó goles o cambios, congelar, exportar esas operaciones y reconciliar antes de volver; restaurar sin reconciliar perdería actividad. Mantener entorno anterior y respaldos hasta cierre del periodo acordado.

Conservar enlaces por mapping: tournament.php (season/category/view), match.php?id y rutas heredadas de resultados → nuevas rutas equivalentes. No convertir números legacy en UUID por suposición. APIs retiradas de escritura responden 410; no redirigir un POST antiguo a una operación nueva.

Implementación de preparación MIG-06: publicación/ocultamiento de importados, readiness, paquete de aplicación Hostinger, preflight y ensayo de respaldo/restauración en segunda DB aislada. El corte real sigue condicionado a configuración/acceso de alojamiento, exportación reciente, nombre/zona oficiales y ventana acordada. Ver [HOSTINGER.md](../HOSTINGER.md).
