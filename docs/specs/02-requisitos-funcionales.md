# 02 — Requisitos funcionales

## Alcance y roles

Primera versión: web pública y operación completa del torneo con paridad de las capacidades actuales. Propuestas posteriores: cobros, portal de equipos, tarjetas/sanciones, notificaciones push y operación sin conexión.

| Operación | Visitante | Anotador | Administrador |
| --- | --- | --- | --- |
| Consultar contenido y competiciones publicadas | Sí | Sí | Sí |
| Enviar consultas públicas | Sí, con límites | Sí | Sí |
| Ver partido privado asignado y su plantilla mínima | No | Solo asignados | Sí |
| Cambiar estados, registrar/anular goles | No | Solo asignados | Sí |
| Confirmar/reabrir resultados y resolver empates | No | No | Sí |
| Catálogos, reglas, sorteos, horarios y usuarios | No | No | Sí |
| Consultar auditoría y reconciliar importación | No | No | Sí |

Ocultar botones no sustituye la autorización por objeto en el backend. Contacto y fecha de nacimiento de jugadores no se publican en DTO públicos.

## Requisitos y aceptación

### RF-01 — Temporadas

Crear, editar y archivar temporadas; como máximo una activa. Una archivada no puede activarse ni admitir cambios deportivos. Zona IANA por temporada; persistencia UTC y presentación en su zona, inicialmente America/New_York como propuesta heredada. Activaciones simultáneas deben resolver la exclusividad dentro de una transacción.

Aceptación: al activar B después de A, solo B queda activa; dos peticiones simultáneas nunca dejan dos activas. Sin temporada activa, mostrar un estado vacío y enlace al archivo.

### RF-02 — Categorías y competiciones

Las categorías deportivas confirmadas son Infantil, Junior, Adulto y Femenino, cada una con su propia competición por temporada. Cada competición se organiza en dos grupos internos, A y B, para un total de ocho grupos. A/B son grupos de la misma competición; las eliminatorias, si se habilitan, pueden cruzarlos según reglamento, pero nunca cruzar competiciones. Inscripciones, plantillas, fixtures, clasificación, goleadores, llaves y campeón son independientes entre Infantil, Junior, Adulto y Femenino; ningún sorteo, clasificación o avance puede cruzar estas competiciones. Formatos `groups` y `knockout`; puntos por victoria/empate/derrota; duración y configuración de grupos. Bloquear cambios de reglas cuando existan fixtures, hasta retirar el sorteo válido. Conservar las categorías originales como procedencia de migración y vincularlas al catálogo confirmado mediante mapping explícito. No deducir edades de los nombres.

Límites de paridad: duración 10–180 minutos; puntos 0–20; grupos 1–32; capacidad 2–32; clasificados 1–16 y menos que el tamaño efectivo de cada grupo. La separación de las cuatro competiciones y sus grupos A/B está confirmada (D-02). Para esta edición, configurar formato groups y groupCount=2; los otros formatos y cantidades siguen siendo capacidades del sistema, no la configuración acordada. Rangos de edad, fecha de corte y correspondencia con categorías/grupos legacy siguen pendientes (D-03 y D-10).

### RF-03 — Equipos e inscripciones

Equipo como identidad estable; inscripción única por equipo/competición. Permitir nombres repetidos con IDs diferentes. Solo equipos no archivados pueden inscribirse. Tras sorteo, bloquear altas de inscripciones hasta retirar fixtures no iniciados.

Aceptación: un fixture con participantes de competiciones distintas se rechaza; doble inscripción devuelve conflicto; Galacticos 6, 29 y 36 conserva tres identidades. Archivar un equipo no elimina sus resultados.

### RF-04 — Jugadores y plantillas

Nombre, nacimiento opcional y contacto privado. Una plantilla vincula jugador e inscripción con dorsal 0–999 único por inscripción; el jugador no puede participar en dos equipos de la misma competición. Fecha válida no futura. Edición de dorsal sin reasignar identidad. No exigir nacimiento histórico inexistente.

Aceptación: dos altas concurrentes para el mismo jugador/competición o dorsal/equipo dejan una sola fila válida. Elegibilidad por edad se habilita únicamente al cerrar D-03.

### RF-05 — Sorteo y fixtures

Entre 2 y 512 inscripciones. Modo aleatorio simple o manual; manual incluye cada inscripción exactamente una vez. Grupos distribuidos por turnos, al menos dos equipos por grupo, capacidad suficiente. Nombrar los dos grupos A y B en esta edición. Generar n(n−1)/2 partidos por grupo. Eliminación directa completa al siguiente tamaño potencia de dos, con pases libres explícitos.

La vista previa lleva identificador, huella de reglas/inscripciones y caducidad propuesta de 30 minutos. Publicación atómica; preview obsoleta se rechaza. Regenerar solo sin encuentros iniciados y sin horarios/canchas asignados; pases libres automáticos no cuentan como encuentros jugados. Publicar no crea duplicados ante reintento.

Aceptación: 3 equipos en eliminación producen un pase libre y un partido, luego una final; 4 equipos en grupo producen 6 encuentros; cambiar una inscripción invalida la vista previa.

### RF-06 — Clasificación y llaves

Puntos, diferencia de goles y goles a favor en orden descendente. El nombre solo estabiliza presentación, nunca decide un cupo deportivo. Confirmar todos los partidos de grupos antes de clasificar. Administrador indica clasificados y orden de cruces; validar cupos y que no excluya un equipo superior. Empate exacto requiere decisión con motivo registrada: mejora explícita respecto al PHP, que registra la selección pero no exige motivo particular de desempate.

Ganador confirmado alimenta rondas posteriores; no generar dos veces la misma ronda. Retirar rondas posteriores requiere motivo y que no hayan comenzado. No borrar encuentros jugados para permitir una corrección.

### RF-07 — Programación y asignación

Sedes con dirección y canchas activas. Horario manual para partidos pendientes; hora o cancha pueden permanecer sin definir. Detectar intersecciones de intervalos [inicio, inicio+duración) por cancha y por identidad de equipo, incluso entre categorías. Horarios contiguos son válidos. No convertir `last_update` legacy en horario.

Un anotador activo por partido como regla de aplicación. Reasignación atómica y auditada. Un anotador retirado pierde acceso en la siguiente operación.

Aceptación: dos programaciones concurrentes incompatibles no se confirman ambas. La zona de temporada se muestra junto al selector; fechas locales inexistentes por cambio horario se rechazan y las ambiguas exigen offset explícito.

### RF-08 — Partido, reloj y eventos

Estados conservados y transiciones:

| Origen | Destinos permitidos |
| --- | --- |
| scheduled | live, suspended |
| live | half_time, paused, finished, suspended |
| half_time | live, finished, suspended |
| paused | live, finished, suspended |
| suspended | live, finished |
| finished | Ninguno; reapertura quita confirmación, no reinicia reloj |

Exigir ambos equipos para operar; pases libres son resoluciones automáticas. El reloj suma segundos persistidos más diferencia con hora del servidor solo en `live`; pausa conserva acumulado. No finalizar automáticamente por duración. Suspender antes del inicio no equivale a cancelación definitiva.

Eventos `goal` y `own_goal`: equipo del autor, minuto entero 0–300, jugador de su plantilla opcional. Autogol suma al rival y no al ranking de goleadores. Se admiten eventos en live, half_time, paused y finished no confirmado, conservando comportamiento actual. Anulación lógica con motivo, actor y fecha; corrección mediante anular y registrar el correcto.

Aceptación: pausar A no modifica B; recargar no reinicia tiempo; dos envíos de la misma operación registran un solo gol. El marcador de partidos nuevos siempre coincide con eventos no anulados.

### RF-09 — Confirmación y correcciones

Solo admin confirma un partido finished no confirmado. Empate de grupos es válido. Eliminatoria empatada exige penales enteros 0–100, distintos y no negativos; separados del marcador, diferencia de goles y goleadores. Confirmar resultado y propagar ganador en una transacción.

Reabrir requiere motivo y ambos participantes; bloquear si existen rondas dependientes hasta retirarlas conforme RF-06. Conserva finished, permite corregir eventos y exige nueva confirmación. No permitir editar directamente marcador agregado para partidos nuevos. Datos importados usan el tratamiento de MIG-04.

### RF-10 — Tablas y goleadores

Oficial: partidos de grupo finished y confirmados. Provisional: live, half_time, paused y finished, indicando que incluye resultados no confirmados; suspended queda excluido como en PHP actual. Ambos modos explican su alcance. Tabla por grupo con PJ/G/E/P/GF/GC/DG/Pts.

Goleadores: goles normales no anulados de partidos confirmados con autor identificado; autogoles excluidos. No inventar goleadores para el dump vacío de eventos. Estadísticas legacy se muestran con procedencia y aviso, separadas de estadísticas calculadas.

### RF-11 — Web pública

Portada, acerca de, galería, contacto, centro de torneo y detalle de partido. Filtros de temporada, categoría, fecha y estado en URL. Centro incluye fixtures/resultados, tablas, llaves y goleadores. Partidos simultáneos en juego/descanso/pausa; suspendidos separados. Banda con partidos activos, finales del día y próximos encuentros.

Actualización compartida cada 5 segundos mientras pestaña visible; conservar filtros, scroll y datos anteriores ante fallo. Mostrar última actualización y desconexión; refrescar al recuperar conexión. Lectura de información no publicada devuelve 404. No devolver nacimientos, contactos, hashes, auditoría o datos de importación en respuestas públicas.

### RF-11A — Landing React con paridad visual y funcional obligatoria

Referencia confirmada el 14 de noviembre de 2026: smokymountaincup.com y sus subpáginas publicadas. El checkout PHP local ya contiene un diseño distinto y no es referencia visual autoritativa. Ver [inventario y validación](../PUBLIC-SITE-PARITY.md).

Requisito explícito del propietario: migrar la landing actual a React **tal cual está**, sin rediseño ni cambios de funcionalidad. La referencia es la landing PHP actual renderizada desde `index.php`, incluidos cabecera, navegación, pie, secciones y componentes compartidos que aparecen en ella. Esta instrucción prevalece sobre propuestas de cambio visual o de interacción de estas SPECS.

Conservar estructura, orden, contenido, tipografías, colores, tamaños, espaciado, fondos, imágenes y recortes, iconos, bordes, sombras y comportamiento responsive. Reutilizar los recursos actuales y estilos necesarios; no sustituirlos por una librería de componentes que cambie el aspecto. Portar interacciones a React manteniendo resultados observables: navegación, formularios y validaciones visibles, mensajes, enlaces, resultados en vivo, filtros, controles, animaciones y galería presentes en la landing. No añadir secciones, campos, bandejas o pasos visibles al flujo público bajo esta migración.

La implementación interna puede cambiar a componentes React y consumir NestJS, siempre que preserve el contrato observable para el visitante. Las mejoras de persistencia/correo solo pueden incorporarse si no alteran ese contrato; cualquier cambio visible requiere una decisión explícita posterior del propietario. Conservar compatibilidad de URLs públicas y destinos de enlaces.

Antes de portar, ejecutar la versión PHP en un entorno aislado y capturar referencia: screenshots de página completa, estados interactivos, contenido, recursos cargados y comportamiento en escritorio y móvil. Usar mismos datos, viewport, fuentes y estado de reloj/animaciones para comparar PHP y React. No utilizar la revisión estática de este documento como sustituto de esa referencia renderizada.

Aceptación: comparar lado a lado y mediante diferencias de imágenes en tamaños representativos (incluidos 360, 390, 768 y 1440 px), sin diferencias de layout, contenido o estilo deliberadas; investigar diferencias y documentar únicamente variaciones de rasterizado inevitables. Verificar además navegación, formularios, galería, resultados y reconexión con escenarios equivalentes. Pruebas visuales con datos y tiempo deterministas para evitar diferencias debidas al marcador. La landing no se considera terminada hasta aprobar paridad visual y funcional. Las mejoras de accesibilidad propuestas deben preservar apariencia y comportamiento; si implican un cambio perceptible, plantearlas por separado.

### RF-12 — Contenido y consultas

Póster: título, alt, imagen, enlace HTTP/HTTPS opcional, orden, activo y ventana de publicación válida. Escudos y pósteres JPEG/PNG/WebP, hasta 8 MiB, ancho/alto hasta 8000 y máximo 30 millones de píxeles, inspección real de formato y nombre generado. Inventariar y copiar recursos usados de galería; no asumir que todo upload es contenido publicado.

Contacto: nombre/email/mensaje. Consulta de equipo: equipo/representante/email/teléfono/jugadores o categoría de interés. Vendedor: nombre/email/teléfono/producto. Mantener límites actuales de 120 para nombres, 160 email, 40 teléfono y 6000 texto. Solicitud no inscribe automáticamente ni crea usuario.

Propuesta para evitar pérdidas: persistir consulta y trabajo de correo en transacción, devolver acuse de recepción, reintentar SMTP y registrar estado; comunicar “recibida” separado de “entregada al proveedor”. Bandeja administrativa de consultas incluida como mejora propuesta, pendiente D-06. Sin esta mejora, mantener respuesta de error explícita si falla SMTP.

### RF-13 — Acceso y auditoría

Login, logout, cambio de contraseña propia y restablecimiento administrativo. Sesiones revocadas al cambiar contraseña o desactivar usuario. No permitir al administrador quitarse su propio rol o desactivarse; proteger además la existencia de al menos un administrador activo.

Auditar cambios de reglas, sorteos, clasificados, programación, asignaciones, eventos, confirmaciones, reaperturas y usuarios; incluir actor, instante UTC, entidad, operación y motivo cuando aplique. Excluir contraseñas, tokens, contacto y nacimiento de logs. Retención y acceso por definir en D-07.
