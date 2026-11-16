# Continuidad de la edición y reconciliación del legacy

## Decisiones confirmadas

Se conserva la edición actual como operativa y se reconcilian sus datos. No se creará una nueva ni se ejecutará el archivado automático del importador PHP anterior.

| Origen | Destino confirmado | Grupo destino |
| --- | --- | --- |
| Categoria A · Grupo A/B | Adulto | A, reuniendo los dos grupos originales. |
| Categoria B · Grupo A/B | Adulto | B, reuniendo los dos grupos originales. |
| Femenil · Grupo A | Femenino | A, conservando la denominación original. |
| Femenil · Grupo B | Femenino | B, conservando la denominación original. |
| Juvenil · 6–9 años | Infantil | A. |
| Juvenil · 10–11 años | Infantil | B. |
| Juvenil · 12–13 años | Junior | A. |
| Juvenil · 14–17 años | Junior | B. |

El propietario confirmó reunir toda Categoria A en Adulto A y toda Categoria B en Adulto B. Se conservan los IDs y las filas de los cuatro grupos de origen como procedencia; no se fusionan equipos por nombre.

La clasificación de las franjas originales no activa validaciones nuevas de edad ni fija una fecha de corte. El nombre oficial de la edición y las reglas vigentes aún deben incorporarse a la configuración revisada.

## Herramientas implementadas

Desde la raíz, después de `npm ci` y `npm run build`:

```sh
node apps/api/dist/imports/cli.js inspect /ruta/absoluta/base.sql
node apps/api/dist/imports/cli.js plan /ruta/absoluta/base.sql \
  --mapping docs/migration-mapping.example.json \
  --out artifacts/reconciliacion.json
```

También existen los scripts `legacy:inspect` y `legacy:plan` del workspace @smoky/api; si se usan desde npm, pasar rutas absolutas porque npm ejecuta el script dentro de apps/api.

El perfil de ejemplo contiene las correspondencias confirmadas para los diez grupos de origen y los ocho grupos de destino. Verifica ID de grupo, nombre original, categoría e identidad de categoría; no confía solo en IDs. Un perfil no coincidente se marca como pendiente, nunca reasigna otra categoría silenciosamente.

El lector:

- Solo extrae INSERT de valores literales de las siete tablas conocidas. No ejecuta SQL, no interpreta funciones y no abre una conexión de base de datos. Rechaza escrituras no admitidas y formatos de rutinas.
- Admite el formato literal del dump entregado, hasta 50 MiB y UTF-8 válido. Conserva números, null, Unicode, comillas y espacios internos/originales de las cadenas.
- Calcula SHA-256 del archivo y un ID determinista del plan según origen, perfil y versión del analizador.
- Verifica claves y referencias, estados y discrepancias aritméticas; mantiene cada fila original en el reporte detallado.
- Informa equipos/partidos por competición y capacidad mínima necesaria. Adulto contiene 16 equipos; dos grupos necesitan al menos capacidad 8, distinta del valor inicial 4 del panel.
- Conserva last_update como procedencia; scheduledAt y clockStartedAt quedan null. No inventa horarios, goles, autores o año de edición.
- Presenta originales y valores derivados por separado, con resolución pendiente. Los puntos derivados quedan sin calcular hasta confirmar el reglamento.

La salida estándar es un resumen. `--out` crea un reporte detallado local con permiso 0600 en POSIX, sin sobrescribir archivos existentes. Contiene datos de origen: conservarlo en artifacts u otra ubicación privada y no subirlo a Git. La herramienta no copia ni altera el SQL original. El plan de lectura mantiene canApply=false: no escribe en DB. Los comandos separados de lotes, descritos abajo, permiten ensayo en DB aislada y no habilitan un corte de producción.

## Comprobación sobre el archivo proporcionado

El archivo contiene 158 filas: 40 equipos, 40 asignaciones, 4 categorías, 10 grupos, 24 partidos, 0 goles y 40 estadísticas. El plan conserva esas filas, tiene el mapeo completo sin asignaciones pendientes y clasifica:

| Competición | Equipos | Partidos presentes en el SQL |
| --- | ---: | ---: |
| Infantil | 8 | 12 |
| Junior | 8 | 12 |
| Adulto | 16 | 0 |
| Femenino | 8 | 0 |

Persisten las 21 discrepancias aritméticas documentadas: 20 diferencias de goles y un total de jugados. Además, hay 25 filas cuyas cifras de partidos jugados no pueden reconstruirse con los encuentros exportados. Son motivos de revisión que pueden afectar las mismas filas, no 46 correcciones nuevas.

No se corrige DG automáticamente ni se descartan las estadísticas por no tener partidos completos. El reporte conserva cada valor original, el cálculo aritmético comparable y una resolución pendiente con motivo. Tampoco fusiona los equipos llamados Galacticos.

## Siguiente paso de migración

El propietario confirmó conservar las cifras actuales como base inicial revisada y sumar los resultados nuevos. Confirmar nombre de edición y reglas vigentes; registrar esa conservación por fila con actor/motivo y ensayar respaldo/restauración y corte. Hasta el corte, el feed continúa configurado explícitamente como legacy. Solo se han promovido copias en bases desechables de ensayo; no se ha realizado promoción en un entorno operativo.

Validación del mapeo confirmado: compilación de ambas aplicaciones y 17 pruebas unitarias correctas. La lectura del SQL conserva su SHA-256 original y confirma Adulto A/B con 8 equipos por grupo, e Infantil, Junior y Femenino A/B con 4 por grupo. No se ejecutó ninguna importación.

## Lotes en MariaDB aislada

Se implementaron `stage`, `report`, `decide` y `promote` en `apps/api/dist/imports/batch-cli.js`. Es una herramienta local de ensayo, sin endpoint HTTP. Requiere las tres migraciones del sistema, un administrador activo con contraseña actualizada, `NODE_ENV=test`, `LEGACY_IMPORT_ISOLATED=1`, host loopback y nombre de base `smoky_import_test_<10 hex>` o `smoky_system_test_<10 hex>`. No ofrece una opción para habilitar producción.

`npm run test:imports` crea su propio contenedor MariaDB, credenciales aleatorias y base vacía; prueba los datos sintéticos, elimina contenedor y temporales incluso al fallar. Para ensayar el archivo suministrado, sin ejecutarlo:

```sh
npm run build
node --import tsx scripts/test-imports.mjs /ruta/absoluta/base.sql
```

El propietario aprobó conservar las cifras actuales como base inicial revisada. El ensayo registra esa conservación y comprueba transporte, repetibilidad y suma de resultados nuevos. Sus actores y motivos son de prueba, no sustituyen el registro del operador en el corte. No activa la temporada ni cambia el origen del feed.

Para un entorno local aislado ya preparado, con `APP_DB_*` configurado y UUID real de administrador:

```sh
node apps/api/dist/imports/batch-cli.js stage /ruta/base.sql --actor UUID
node apps/api/dist/imports/batch-cli.js report ID_LOTE --actor UUID --out artifacts/revision.json
node apps/api/dist/imports/batch-cli.js decide ID_LOTE --actor UUID --decisions /ruta/decisiones.json
node apps/api/dist/imports/batch-cli.js promote ID_LOTE --actor UUID --config /ruta/edicion.json
```

`edicion.json` exige `name`, `timezone` y `statisticsPolicy: "reviewed-initial"`; no se deducen del dump. El ensayo usa un nombre que indica expresamente su carácter técnico. `decisiones.json` es una lista de decisiones por equipo, no una orden de corregir todas las filas:

```json
[
  {
    "sourceTeamId": 1,
    "expectedRevision": 0,
    "mode": "preserve",
    "reason": "Motivo documentado por el organizador para conservar el snapshot."
  }
]
```

En modo `correct` se exige además `values` con las ocho métricas: games_played, wins, draws, losses, goals_scored, goals_conceded, goal_difference y points. Deben ser enteras y PJ/DG coherentes. Los puntos requieren revisión humana del reglamento. Cada revisión conserva actor, motivo, fecha y valores elegidos en una fila nueva; `expectedRevision` evita perder decisiones concurrentes. La revisión inicial es 0. Un archivo con una decisión inválida se revierte completo. Las decisiones de un lote promovido son inmutables.

La promoción exige mapeo completo, ausencia de bloqueantes, decisión explícita sobre todos los snapshots, destino deportivo vacío y partidos sin iniciar, 0–0 y sin goles. Los dumps con partidos activos, resultados o goles quedan en staging: aún necesitan una política de marcador base y eventos. No se inventan eventos ni jugadores para promoverlos.

Todo el lote se promueve en una transacción bajo el mismo bloqueo que las escrituras deportivas. Conserva equipos distintos aunque tengan igual nombre, inscripciones, ocho grupos, partidos, snapshots y mappings de cada fila original. Juvenil se vincula a dos categorías de destino; por ello puede haber más vínculos que filas, sin pérdida ni duplicación de entidades. Las canchas mantienen su etiqueta bajo una sede marcada como importada pendiente de completar; dirección y horarios siguen sin inventarse.

Una promoción fallida deja estado failed, registra auditoría y revierte las entidades nuevas. Se puede corregir la revisión y reintentar; repetir una promoción exitosa con igual configuración devuelve la misma temporada. Cambiar configuración en ese reintento se rechaza. El comando report verifica conteos, payloads/checksums y existencia de todos los destinos vinculados; el informe detallado se crea con permiso 0600 y sin sobrescritura.

La edición promovida queda sin activar, sin archivar y con las cuatro competiciones sin publicar ni reglas confirmadas. La política confirmada se integra en clasificación oficial, provisional y clasificación a eliminatorias: cada métrica es la cifra inicial revisada más la contribución de partidos nuevos. DG suma la diferencia de cada partido a la DG original; no se recalcula desde GF/GC acumulados, para no corregir silenciosamente discrepancias conservadas. Reabrir un resultado elimina únicamente su contribución nueva. Cada fila expone baseline y data_origin=reviewed_initial_plus_native. No se inventa historial de goles para goleadores.

Un snapshot debe corresponder a una sola inscripción de destino; si el mismo equipo participa en varias competiciones, se rechaza la promoción hasta definir el alcance. Cambiar los puntos por victoria/empate/derrota afecta resultados nuevos, nunca recalcula los puntos iniciales. Activación, reglas y publicación siguen siendo acciones explícitas del administrador; el importador no las ejecuta.

El sorteo nativo no puede reemplazar grupos/partidos de una competición importada, para preservar sus vínculos de procedencia. La publicación de fixtures importados está implementada en Organización y en POST /api/v1/competitions/:id/imported-publication; exige reglas confirmadas, versión, motivo, Idempotency-Key e integridad del lote. No se usa un nuevo sorteo para publicarlos. El ensayo no cambia automáticamente el tráfico ni la configuración PUBLIC_DATA_SOURCE.

Verificación ejecutada: 20 pruebas unitarias; 29 comprobaciones de importación con datos sintéticos y las mismas 29 con el SQL proporcionado; regresión de 88 comprobaciones de API/MariaDB, 8 pruebas de navegador y 6 smoke API. Los contenedores y archivos temporales se eliminaron al terminar. El informe [import-validation-report.json](import-validation-report.json) contiene únicamente conteos y resultados, sin datos operativos originales.

La publicación y el retiro mantienen los IDs originales y snapshots; el retiro solo cambia visibilidad. El ensayo ampliado incluye publicación real desde navegador y respaldo/restauración en otro contenedor, verificando conteos de todas las tablas. Ver [HOSTINGER.md](HOSTINGER.md) para el despliegue y corte preparados.
