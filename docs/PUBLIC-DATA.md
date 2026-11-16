# Datos deportivos de la landing

La landing y sus páginas deportivas consumen NestJS. El HTML capturado queda como plantilla visual; sus nombres, horarios y resultados de muestra no son un respaldo de datos operativos.

## Fuente y publicación

`GET /api/v1/public/site` entrega una proyección de la temporada activa y no archivada, exclusivamente de sus competiciones publicadas. La lectura usa una transacción consistente y devuelve temporada, competiciones, grupos, clasificación oficial, partidos y plantillas públicas. No depende de que `PUBLIC_DATA_SOURCE` seleccione el adaptador antiguo para otras rutas: esta proyección consulta siempre la base nueva `APP_DB_*` administrada por el panel.

Sin temporada activa o sin competiciones publicadas, la respuesta contiene listas vacías. Sin base disponible responde con error; la web no vuelve a las cifras congeladas del tema. Publicar una competición importada conserva sus estadísticas iniciales revisadas y sus fixtures. Ocultarla la retira también de esta proyección.

La clasificación utiliza el mismo cálculo oficial del sistema: base inicial revisada más resultados nuevos confirmados. Los marcadores en curso se muestran separados del concepto de resultado confirmado. Los goles de las estadísticas individuales cuentan eventos identificados, confirmados y no anulados; los autogoles se separan. Nunca se inventan autores para explicar estadísticas importadas.

## Secciones conectadas

| Superficie | Datos y navegación |
| --- | --- |
| Barra Upcoming Match | Siguiente encuentro pendiente de la edición publicada, fecha/hora y sede reales; enlace al detalle. |
| Portada, Latest Games | Los partidos de la edición se distribuyen en las dos tablas originales. Muestran categoría/grupo, horario o marcador y enlace por ID. |
| Portada, League Table | Vista previa de hasta cuatro equipos del primer grupo de la primera competición publicada con clasificación, o del contexto solicitado. Conserva el widget original, mostrando goles a favor; sus enlaces abren la clasificación correspondiente. |
| Schedule | Partido destacado y listado, nombres, horarios, sedes y resultados reales en los contenedores originales. |
| Games Details / Results | Vista previa de los dos primeros partidos o el partido solicitado por ID. No sustituye un ID inexistente por otro encuentro. |
| Games List / Blocks | Partidos publicados, clasificación por competición/grupo y enlaces al detalle; conserva ordenación/paginación donde corresponden. |
| Game Calendar | Mes y días con partidos según la zona de la temporada, navegación mensual y enlaces. |
| League Table | Tablas independientes por competición y grupo A/B; no mezcla rankings de categorías distintas. Conserva las columnas originales Pos/Club/W/L, calculadas con la clasificación oficial. |
| Player List / Gallery / Details / Statistics | Plantillas públicas, nombres, dorsales, equipos y goles identificados. Los enlaces conservan el contexto de competición y jugador. |
| Box Scores | Plantillas de los dos equipos del partido e iconos de sus eventos de gol, consultados al endpoint público de detalle. |

Los parámetros `competition` (ID o slug) y `group` restringen el contexto a los datos públicos recibidos. Los enlaces a partido usan `id`; las fichas usan `player`. Ningún parámetro permite consultar competiciones ocultas ni datos privados de personal/jugadores.

Las páginas consultan cambios cada cinco segundos mientras están visibles y reanudan la consulta al volver a la pestaña. Cada petición tiene un tiempo máximo de diez segundos. Si una actualización falla, conservan la última respuesta recibida y la señalan como desactualizada en las secciones deportivas. Una primera carga fallida informa indisponibilidad; una edición vacía informa ausencia de datos.

## Uso desde el panel

1. Preparar/importar la edición en la base nueva.
2. En Temporadas, revisar nombre, zona y reglas de cada competición.
3. En Organización, publicar los datos importados o el sorteo de una competición nueva.
4. Activar la temporada que debe aparecer en la landing.
5. Programar partidos, registrar jugadores/plantillas, operar goles y confirmar resultados.
6. Revisar la portada, Schedule y League Table. Los cambios deportivos se reciben desde la API sin editar archivos de la landing.

No generar otro sorteo para publicar una competición importada. Tener un equipo en el catálogo no lo hace aparecer en una competición: debe tener su inscripción. Del mismo modo, un jugador debe pertenecer a una plantilla de una competición publicada para aparecer en sus páginas públicas.

## Contenido y campos que no son datos deportivos editables

El tema, las animaciones, textos institucionales, fotografías de galería, hero y carteles promocionales originales siguen siendo contenido editorial. No se añadió un CMS de medios bajo esta integración.

El panel no registra escudos/fotos de jugadores, nacionalidad, posición, asistencias, tarjetas, apariciones, ratios de victorias ni desglose de goles por tiempo. Las fichas no reutilizan fotos o estadísticas de jugadores ficticios del tema para suplirlos: usan el emblema general como imagen neutra y un guion para los campos desconocidos. Los partidos sin horario o sede se indican como pendientes. Las fechas de nacimiento, contactos privados, contraseñas, sesiones y decisiones de reconciliación no se devuelven en la proyección.

## Validación

La prueba de navegador real crea y opera un partido con la API administrativa sobre una MariaDB descartable. Abre después las páginas originales de resultados y comprueba que anular un gol desde el sistema actualiza el marcador público sin recargar. También verifica plantillas, clasificación y exclusión de contactos privados.

Las pruebas de importación verifican que esta proyección devuelve la base inicial revisada y que ocultar la competición elimina sus datos públicos. Las pruebas con respuestas controladas cubren vacío, error inicial, última lectura desactualizada, calendario, enlaces con contexto, ordenación/paginación y nombres con caracteres HTML.

La comparación visual conserva los recursos originales independientes. Para comparar bajo los mismos datos dinámicos, inserta en la referencia capturada la misma proyección DOM deportiva que muestra React. Comprueba así estilos, tipografías y contenedores del tema bajo contenido equivalente; no es una prueba independiente del renderer de esos fragmentos. La corrección del enlace de datos se verifica por las pruebas API/navegador anteriores. El informe estático del 14 de noviembre no certifica esta integración ni la actualización desde el panel.

Resultados de esta integración: [public-data-validation-report.json](public-data-validation-report.json). El comparador conserva los límites entre nodos de texto de React, comprueba geometría y completa las animaciones CSS finitas solo durante la captura. Una diferencia aislada de hasta 50 píxeles con geometría e inventarios idénticos puede generar una segunda captura completa; el resultado aceptado sigue exigiendo cero diferencias al umbral 0.1. No se aumentó la tolerancia de píxeles para aprobar.
