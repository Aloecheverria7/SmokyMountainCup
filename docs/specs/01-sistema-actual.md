# 01 — Análisis del sistema actual

## Capas encontradas

| Capa | Evidencia | Conclusión |
| --- | --- | --- |
| Datos originales actuales | `u460493799_smokyOriginal.sql` | Base operativa confirmada por el propietario; siete tablas, 158 filas; no contiene usuarios, temporadas ni jugadores. |
| Dominio PHP reciente | `app/bootstrap.php`, `migrations.php`, `competition.php`, `matches.php`, `admin.php`, `rules.php` | Implementa operación del torneo sobre tablas `cup_*`, PDO y transacciones. |
| Público | `index.php`, `tournament.php`, `match.php`, `api/results.php`, `api/match.php`, `app/public.php` | Portada, resultados simultáneos, clasificación, fixtures, llaves, goleadores e historial. |
| Administración | `admin/index.php`, `admin/api.php` | Panel y API por acciones; roles admin y scorer; edición y anotación. |
| Contacto | `app/mail.php`, `mail.php`, `inscriptionmail.php`, `sellermail.php` | Solicitudes por SMTP; no son inscripciones aprobadas en base de datos. |
| Compatibilidad y plantilla | `games-*.php`, `player-*.php`, `plugins/`, secciones antiguas | Varias rutas son adaptadores; no confundir nombres de archivos con módulos de negocio completos. |
| Documentación anterior | `docs/REVISION-DEL-SITIO.md`, `IMPLEMENTACION.md`, `INSTALACION.md` | La auditoría inicial precede al panel actual. Sus fallos no se pueden trasladar automáticamente a la versión presente. |

El backend usa funciones globales y HTML generado en servidor; no se observa una separación formal entre aplicación, persistencia y transporte. `admin/api.php` concentra muchas operaciones y su GET devuelve colecciones completas para administradores. La futura API debe separar recursos y paginar consultas.

## Datos comprobados

| Tabla | Filas | Observación |
| --- | ---: | --- |
| categories | 4 | Categoria A, Categoria B, Femenil, Juvenil. |
| groups | 10 | Dos grupos en cada categoría adulta; cuatro grupos de edad bajo Juvenil. |
| teams | 40 | Galacticos aparece en IDs 6, 29 y 36; no fusionar por nombre. |
| group_teams | 40 | Asignaciones explícitas entre grupo y equipo. |
| games | 24 | Todos con estado `not started`, minuto 0 y marcador 0–0; corresponden a equipos juveniles. |
| goals | 0 | Existe estructura, sin INSERT de datos. |
| team_stats | 40 | Contiene estadísticas no reconstruibles con estos 24 partidos pendientes. |

El encabezado del dump indica exportación el 15 de octubre de 2026 y MariaDB 11.8.9. Los `last_update` de los partidos son de 2024; no representan una fecha de inicio programada ni permiten deducir el año oficial de una edición.

Hay 20 filas con `goal_difference != goals_scored - goals_conceded` y una con `games_played != wins + draws + losses`: equipo 2 tiene 4 jugados y 3 victorias, sin empates ni derrotas. Equipo 1 tiene GF=8, GC=3 y DG almacenada=0. No hay evidencia suficiente para decidir cuál valor es correcto. Ver [reporte de datos](legacy-data-audit.json).

## Capacidades que deben conservarse

- Una temporada activa, archivo de temporadas y zona horaria por temporada.
- Categorías; competición por temporada/categoría; puntos, duración, grupos, cupos y clasificados configurables.
- Equipos reutilizables, inscripciones y plantillas con dorsal; jugador único por competición.
- Grupos todos contra todos a una vuelta; sorteo aleatorio o reparto manual por turnos con vista previa y comprobación de cambios antes de publicar.
- Eliminación directa, pases libres, confirmación de clasificados, orden explícito de cruces y avance de ganadores confirmados.
- Sedes, canchas, horarios manuales y control de solapamiento de cancha/equipo.
- Anotador asignado por partido; reloj calculado por servidor; goles/autogoles y anulación con motivo.
- Resultado final sujeto a confirmación administrativa; penales separados; reapertura limitada por rondas dependientes.
- Concurrencia mediante versión de partido, bloqueo y claves para reintentos sin duplicación.
- Tablas oficiales/provisionales; goleadores con autor conocido y resultado confirmado.
- Pósteres con vigencia, orden, imagen y enlace; escudos; galería pública; contacto, consultas de equipos y vendedores.

## Límites relevantes

1. El importador actual convierte el dump en historial de solo lectura. Preserva las filas originales, pero esto no autoriza a archivar datos actuales en la nueva versión.
2. Juvenil agrupa rangos 6–9, 10–11, 12–13 y 14–17 como grupos de una misma categoría. El propietario confirmó que el modelo de negocio distingue Infantil, Junior, Adulto y Femenino como competiciones independientes. Cada una tiene grupos A y B, para ocho grupos destino frente a los diez del dump. El esquema legacy no expresa directamente esa estructura; falta el mapping de categorías y grupos a las cuatro competiciones. No generar cruces de edades ni reasignaciones automáticamente.
3. Las edades de categoría se almacenan, pero `save_entity()` no verifica elegibilidad de jugadores respecto a ellas. Hace falta definir fecha de corte y política antes de añadir esa validación.
4. `published` está vinculado a publicar el sorteo; no hay un flujo editorial completo para toda la web.
5. No hay pagos, ecommerce, autoservicio de representantes, tarjetas, sanciones, prórrogas, newsletter funcional ni sincronización de escrituras sin conexión comprobados.
6. El reloj no implementa periodos reglamentarios detallados. La duración configura programación, no una finalización automática.
7. SMTP se ejecuta durante la petición y las consultas no se persisten como expedientes. La entrega al proveedor no garantiza recepción.
8. El historial conserva estadísticas sin reconciliar; no deben mezclarse con tablas oficiales calculadas a partir de partidos nuevos.
9. Hay controles actuales de consultas parametrizadas, sesión, CSRF, permisos y subidas. Esta revisión no constituye una auditoría de explotación ni certifica despliegue, configuración o credenciales.

## Trazabilidad principal

| Requisitos | Fuente actual |
| --- | --- |
| RF-01 a RF-04 | `app/admin.php`, `app/migrations.php` |
| RF-05 a RF-06 | `app/competition.php`, `app/rules.php` |
| RF-07 a RF-09 | `app/matches.php`, `admin/api.php` |
| RF-10 | `tournament.php`, `app/competition.php` |
| RF-11 a RF-12 | `app/public.php`, `index.php`, `app/mail.php` |
| RF-13 | `app/bootstrap.php`, `admin/api.php` |
| MIG-01 a MIG-06 | Dump, `app/legacy.php` y auditoría estática de datos |
