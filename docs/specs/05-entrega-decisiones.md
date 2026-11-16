# 05 — Plan de entrega, validación y decisiones

## Fases y salida verificable

| Fase | Entregable | Condición de salida |
| --- | --- | --- |
| 0. Cierre del dominio | Fuente operativa confirmada; cerrar edición, mapping legacy y reglamento; ADR de stack y despliegue | D-03, D-04, D-09 y D-10 resueltas para las funciones afectadas. |
| 1. Fundaciones | Monorepo, CI, Nest, React, DB, migraciones, login, sesiones, permisos y OpenAPI inicial | Instalación limpia reproducible; prueba de restricción por rol/objeto. |
| 2. Datos y catálogos | Importador, reporte, temporadas, categorías, equipos, inscripciones, jugadores, sedes | MIG-05 aprobada en copia; DB original intacta. |
| 3. Organización | Grupos, previews, eliminación, clasificación, agenda y asignación | Fixtures y conflictos concurrentes probados; revisión del organizador. |
| 4. Jornada | Estados, reloj, eventos, penales, confirmación y corrección | Unicidad de operaciones y consistencia de resultados verificadas. |
| 5. Público y contenido | Landing React idéntica al PHP actual, torneo, tablas, llaves, galería, formularios, pósteres y compatibilidad | Paridad visual y funcional de landing (RF-11A/QA-27), móvil, reconexión y enlaces legacy verificados. |
| 6. Puesta en producción | Ensayo de carga, backup/restauración, corte y rollback | Acta de conteos, smoke y aceptación de organizador. |

No se estima duración ni costo sin conocer equipo, infraestructura y alcance aprobado. Puede avanzarse en fundaciones mientras se cierran reglas; no publicar cuadros juveniles o clasificación reconciliada basados en supuestos.

## Matriz mínima de pruebas

| ID | Escenario | Resultado esperado |
| --- | --- | --- |
| QA-01 | Importación del dump y segundo intento | 158 filas preservadas; segunda ejecución sin duplicados. |
| QA-02 | Galacticos y caracteres Unicode | Tres identidades; nombres exactos. |
| QA-03 | Estadísticas incompatibles | Incidencias visibles; valores originales intactos; no tabla oficial ficticia. |
| QA-04 | Dos activaciones concurrentes | Una sola temporada activa. |
| QA-05 | Dorsal repetido y jugador en dos equipos | Conflicto y una sola asignación válida, incluso concurrente. |
| QA-06 | Grupo de 4 / eliminación de 3 | 6 fixtures / un pase libre más partido y final. |
| QA-07 | Preview con inscripciones modificadas | Publicación rechazada por versión/huella. |
| QA-08 | Choque de cancha/equipo, también concurrente | Solo una programación válida; horarios contiguos permitidos. |
| QA-09 | Anotador consulta/muta partido ajeno | 403/404; cero cambios. |
| QA-10 | Dos envíos iguales de un gol | Un evento, un incremento y respuesta repetible. |
| QA-11 | Clave reutilizada con otro cuerpo | 409; sin efecto adicional. |
| QA-12 | Versión obsoleta con clave nueva | 409; cliente actualiza antes de reintentar. |
| QA-13 | Autogol, anulación y autor opcional | Marcador correcto; autogol no cuenta para goleador. |
| QA-14 | Relojes de dos partidos y recarga | Independencia y acumulado del servidor sin reinicios. |
| QA-15 | Confirmación de eliminatoria empatada | Exige penales válidos; ganador avanza una vez; marcador sin penales. |
| QA-16 | Reapertura con ronda dependiente iniciada | Rechazo sin borrar información. |
| QA-17 | Tabla oficial frente a provisional | Solo eventos/partidos del alcance definido; etiquetas claras. |
| QA-18 | Caída de red, reintento y orden de respuestas | Datos previos visibles; operación sin duplicación; versión antigua ignorada. |
| QA-19 | GET público y borradores | Sin PII, hashes, auditoría o datos privados; borrador no accesible por ID. |
| QA-20 | CSRF, logout, cambio de contraseña y desactivación | Mutación ilegítima rechazada; sesiones revocadas. |
| QA-21 | Subida falsa, ejecutable o excesiva | Rechazo; archivo no ejecutable ni expuesto indebidamente. |
| QA-22 | Fallo SMTP | Error explícito en modo actual o consulta durable/reintento si D-06 aprobado. |
| QA-23 | Zona horaria y transición estacional | UTC consistente; hora inexistente rechazada; ambigua desambiguada. |
| QA-24 | Backup y recuperación | Datos y medios coherentes; medición de tiempos reales. |
| QA-25 | Navegación móvil/teclado/movimiento reducido | Operación completa, foco visible y datos legibles. |
| QA-26 | Acceso desde URL legacy | Recurso equivalente por mapping o estado claro; sin escrituras antiguas. |
| QA-27 | Landing PHP frente a React, con datos/tiempo iguales | Apariencia, responsive, contenido e interacciones conservados según RF-11A; diferencias visuales revisadas y flujos equivalentes comprobados. |

Unitarias para reglas puras; integración con MariaDB desechable para transacciones/FK/bloqueos; E2E para flujos de admin/anotador/visitante. SQLite no demuestra comportamiento de concurrencia MariaDB. Las suites PHP actuales sirven como referencia de escenarios, no como pruebas ejecutables de la nueva API.

## Restricción de implementación confirmada

La landing debe conservar exactamente su diseño y funcionalidad actuales al migrar a React. Crear referencias visuales del PHP antes de modificar o reemplazar su implementación. No tratar la modernización como autorización de rediseño ni cambiar idioma, contenido o flujo de la landing por defecto. D-05 sobre idioma solo aplica a propuestas futuras o superficies sin contenido existente; cualquier cambio de la landing requiere instrucción explícita adicional.

## Decisiones pendientes de producto

| ID | Decisión | Propuesta inicial / consecuencia |
| --- | --- | --- |
| D-01 — Resuelta | Fuente de datos operativa | Confirmado por el propietario el 9 de noviembre de 2026: el SQL suministrado es la base operativa actual. Migrar sus siete tablas; no exigir cup_*. Conservar los datos como operativos, sin archivado automático. |
| D-02 — Resuelta | Organización de competiciones | Confirmado por el propietario: Infantil, Junior, Adulto y Femenino son competiciones independientes, cada una con grupos A y B (ocho grupos en total), sin cruces entre competiciones y con resultados y campeón propios. |
| D-03 | Fecha de corte, elegibilidad, tamaño de plantilla y participación en categorías múltiples | Mantener unicidad por competición; edad sin validación automática hasta fijar reglamento. |
| D-04 | Desempates oficiales, duración por categoría, descansos, prórroga, tercer lugar, separación entre partidos | Mantener puntos/DG/GF y resolución motivada, sin prórroga ni tercer lugar nuevos. Confirmar contra reglamento oficial. |
| D-05 | Idioma y renderizado/SEO | Mantener público inglés/panel español como PHP actual; confirmar bilingüe. Cerrar SSR/prerender antes de rutas públicas. |
| D-06 | Guardar consultas y bandeja administrativa | Recomendado por durabilidad, es ampliación explícita frente al envío SMTP actual. Sin aprobación, conservar flujo actual. |
| D-07 | Privacidad de jugadores, menores, retención, acceso y consentimiento de imágenes | No publicar nacimientos/contactos; definir política con organizador antes de publicar nombres e imágenes. |
| D-08 | Hosting, dominio, presupuesto, correo y objetivos de recuperación/carga | Mantener MariaDB; medir objetivos de arquitectura y ajustar a infraestructura elegida. |
| D-09 — Continuidad resuelta | Continuar la edición actual y reconciliar sus datos | Confirmado por el propietario. No crear edición nueva ni archivar la actual. Nombre oficial pendiente. Política estadística confirmada: conservar las cifras actuales como base inicial revisada y sumar resultados nuevos; originales intactos. |
| D-10 — Resuelta | Correspondencia de origen | Confirmado: 6–9/10–11 → Infantil; 12–13/14–17 → Junior; Categoria A/B → Adulto; Femenil → Femenino. Confirmado: Infantil A = 6–9, B = 10–11; Junior A = 12–13, B = 14–17; toda Categoria A → Adulto A, toda Categoria B → Adulto B; Femenil conserva A/B. |

## Criterio de terminado

Una funcionalidad se considera lista cuando cumple sus requisitos RF, contrato OpenAPI, autorización, pruebas relevantes y manejo de errores/reintentos, con migraciones reproducibles. La versión completa requiere reconciliación documentada, revisión visual, ensayo de restauración y corte aceptado. Un build exitoso no sustituye esos criterios.

## Límites de este análisis

Revisión estática de PHP, dump, rutas y pruebas/documentación existentes. Auditoría aritmética del SQL adjunta; no se ejecutó PHP ni se accedió a producción. No se abrió el ZIP como una segunda fuente autoritativa ni se extrajo contenido de imágenes para interpretar reglamentos. Toda regla no explícita permanece pendiente. No se han implementado NestJS, React, migraciones ejecutables o diseños finales en esta entrega.
