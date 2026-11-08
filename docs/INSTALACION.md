# Instalación y operación

## Estado de esta implementación

Actualización local: `config/local.php` conecta a MySQL/MariaDB en `127.0.0.1:3306`, base `smokydev`, usuario `root`, sin contraseña. Las tablas originales se conservan junto a las nuevas `cup_`. El respaldo anterior a las migraciones está en `storage/smokydev-before-cup.sql`; el acceso administrativo conserva la misma contraseña local. SQLite queda como copia anterior y soporte de pruebas aisladas.

El código incluye web pública, banda de resultados, partidos simultáneos, administración, competiciones, sorteos y registro de goles. La copia SQLite local contiene el historial importado: 40 equipos, 24 partidos y las 158 filas originales conservadas. No se ha creado una temporada activa ni se han inventado categorías de la nueva temporada.

Los datos y credenciales de las pruebas están exclusivamente en bases aisladas. No hay una contraseña administrativa predeterminada. Para esta copia local se generó una contraseña aleatoria única; el acceso está en `storage/ACCESO_LOCAL.md`, protegido del acceso web y excluido del control de versiones. No se ha cambiado el servidor de producción ni enviado correo externo.

## Requisitos

- PHP 8.2 o superior: PDO MySQL, mbstring, fileinfo, OpenSSL y sesiones. SQLite solo es necesario para la vista previa local y pruebas.
- MySQL/MariaDB con InnoDB y utf8mb4. Crear una base vacía o usar la existente: las tablas nuevas llevan prefijo `cup_` y no reemplazan las anteriores.
- Apache con mod_rewrite y AllowOverride para aplicar `.htaccess`. Si se utiliza Nginx, reproducir sus bloqueos antes de exponer el sitio.
- Permisos de escritura en `storage/` y `upload/managed/`; configuración privada sin acceso web.

## Configuración

Copiar `config/example.php` a `config/local.php` y completar DSN, usuario y contraseña. También se aceptan variables `APP_DSN`, `APP_DB_USER`, `APP_DB_PASSWORD`, `APP_TIMEZONE` y `APP_SMTP_*`. El archivo local y el contenido de storage no se versionan.

La zona predeterminada del torneo es `America/New_York`; cada temporada puede tener su zona. Fechas y reloj se almacenan en UTC y se muestran en la zona de temporada. Las fechas de pósteres se introducen en la zona de configuración.

Sin DSN se utiliza `storage/cup.sqlite`, exclusivamente para desarrollo local. **Configurar MySQL antes de ejecutar migraciones en producción.**

```powershell
php tools/cup.php migrate
php tools/cup.php import 'C:/ruta/u460493799_smoky.sql'
php tools/cup.php admin organizacion@ejemplo.com 'Organización'
```

La última orden solicita la contraseña por entrada estándar: mínimo 12 caracteres, sin contraseña predefinida. También sirve para restablecer una cuenta de administrador existente. El SQL se analiza como datos literales de tablas conocidas; no se ejecuta como un script. La importación se rechaza si ya existe historial y no borra registros.

Para abrir localmente:

```powershell
php -S 127.0.0.1:8080 tools/router.php
```

Visitar `http://127.0.0.1:8080/` y `http://127.0.0.1:8080/admin/`. Usar siempre el router: impide acceder a configuración, bases locales, pruebas y archivos internos.

## Preparar la temporada

1. Crear temporada y marcarla activa; la edición histórica permanece archivada.
2. Crear categorías con nombres y edades oficiales. Crear una competición por categoría y temporada con formato, duración y puntos.
3. Reutilizar o agregar equipos e inscribirlos en cada competición. Agregar jugadores y asignarlos a sus plantillas con dorsal.
4. Crear sedes/estadios y sus canchas.
5. En Organización, generar una vista previa aleatoria o introducir IDs de inscripción para distribución manual; comprobarla y publicar.
6. En Partidos, asignar horarios, cancha y anotador. Los solapamientos de cancha o equipo se rechazan.
7. Crear usuarios anotadores y entregarles su acceso. El restablecimiento de contraseña invalida sus sesiones anteriores.
8. Subir pósteres o escudos desde sus formularios. Se admiten JPEG, PNG y WebP hasta 8 MB y dimensiones limitadas.

La asignación manual de grupos utiliza turnos: grupo 1, grupo 2, etc. La vista previa permite comprobar el reparto antes de confirmar. En eliminación directa, los IDs se emparejan en orden; las plazas libres se asignan a los primeros equipos como pases libres.

## Durante la jornada

El anotador abre su partido, inicia el reloj y registra goles con equipo, minuto y autor opcional. Un autogol suma al rival. Para corregir un autor o equipo, anular el evento con motivo y registrar el correcto. Los cambios se confirman después de persistirlos. No hay cola de escritura sin conexión: si falla una respuesta se conserva la operación y se ofrece reintento con la misma clave para evitar duplicados.

La portada muestra simultáneamente todos los partidos en juego, descanso o pausa de las competiciones publicadas de la temporada activa. Los suspendidos aparecen separados. La banda prioriza partidos activos, finales del día y próximos encuentros. Ambas comparten una consulta cada cinco segundos mientras la pestaña está visible. Una pérdida de conexión conserva datos anteriores y muestra aviso.

Al finalizar, el administrador confirma el resultado. Los penales se registran por separado en eliminatorias empatadas. Las tablas oficiales y goleadores utilizan resultados confirmados; las tablas provisionales incluyen encuentros en curso.

Para pasar de grupos a eliminatorias: confirmar todos los resultados, consultar la tabla e introducir los IDs clasificados en el orden de cruces deseado. El servidor verifica cupos y posiciones. Los empates exactos pendientes se resuelven por decisión administrativa registrada al confirmar. No se permite excluir equipos con mejores criterios de clasificación.

Para corregir un resultado con rondas dependientes, retirar primero las rondas posteriores que todavía no hayan empezado, indicar el motivo y reabrir el resultado. Después confirmar de nuevo y reconstruir las rondas o volver a clasificar desde grupos. Las rondas ya jugadas no se borran mediante esa operación.

## Correo

Configurar host SMTP, puerto, seguridad `tls` (STARTTLS, normalmente 587) o `ssl`, usuario, contraseña, remitente autorizado y destinatario. Las conexiones externas requieren cifrado y validación de certificados. Los mensajes usan el remitente configurado y el email del visitante en Reply-To. Los formularios tienen CSRF, honeypot, límites de longitud y frecuencia.

Sin SMTP configurado, la web informa que el mensaje no se envió. La aceptación SMTP no garantiza llegada a la bandeja de entrada; verificar remitente, SPF/DKIM y entrega con el proveedor antes de abrir inscripciones.

## Validación

Para ejecutar toda la suite y preparar la validación de pushes, consultar [PRUEBAS-Y-PUSH.md](PRUEBAS-Y-PUSH.md). El comando unificado es `python tools/check.py --mysql --browser`; crea sus propias bases de prueba y no modifica `smokydev`.

```powershell
php tests/integration.php 'C:/ruta/u460493799_smoky.sql'
python tests/smtp_test.py
node tests/browser.mjs
```

Integración usa SQLite en memoria. Para MariaDB, definir `APP_TEST_MYSQL_DSN` con una base **vacía y desechable cuyo nombre contenga `cup_test`**, además de sus credenciales. No usar una base con datos reales.

Las pruebas de navegador requieren Chrome en la ruta indicada en el script y generan una base aislada, un servidor temporal y capturas en `tests/artifacts/`. Cubren categorías simultáneas, gol administrativo, CSRF, filtros, vista móvil, desconexión/reconexión y protección de archivos privados.

## Publicación y restauración

Antes de desplegar: respaldo íntegro de archivos y SQL del servidor, ensayo de importación en copia, PHP actualizado, HTTPS, SMTP probado y revisión del panel. Desplegar código y migraciones en una ventana controlada; comprobar portada, acceso, fixtures, subidas y un partido de prueba en una temporada no activa.

Las rutas públicas antiguas redirigen al centro de torneo; APIs antiguas de escritura devuelven 410 y ya no escriben. Los fragmentos PHP y las bibliotecas PHP antiguas de Quform quedan bloqueados para acceso web y no forman parte de la nueva aplicación. Algunas bibliotecas retiradas siguen siendo incompatibles con PHP 8; no deben reactivarse.

Para restaurar una publicación fallida, recuperar juntos el respaldo de archivos y la base anterior. No borrar `cup_` ni importar sobre producción para intentar revertir parcialmente. Guardar nuevas copias de respaldo antes de cada futura migración.

Los archivos de `storage/legacy-source/` son copias privadas de páginas retiradas, no un respaldo completo anterior al cambio. Conservarlos fuera del directorio público al trasladar el proyecto si no se necesitan para revisión.
