# Comprobaciones antes de integrar

## Ejecutar localmente

Requisitos: PHP 8.2+, Python 3.10+, Node 22+ y MySQL/MariaDB. Para navegador, Chrome/Chromium. La configuración local de MySQL se lee de `config/local.php`; en CI se usan variables de entorno.

```powershell
# Unitarias, integración SQLite, sintaxis PHP/JS, renderizado y SMTP simulado
python tools/check.py

# Añade integración y concurrencia reales con MySQL/MariaDB
python tools/check.py --mysql

# Añade regresión en navegador (escritorio y móvil)
python tools/check.py --mysql --browser
```

El comando termina con código distinto de cero ante cualquier fallo. No basta con imprimir advertencias. Las reglas deportivas puras se prueban sin base de datos; las comprobaciones de integración prueban persistencia y permisos; el navegador cubre recorridos completos.

`PHP_BINARY` y `CHROME_BIN` permiten indicar ejecutables distintos. En Linux se detecta Chrome/Chromium; en Windows se conservan las rutas de XAMPP/Chrome como valores predeterminados. Las capturas se guardan en `tests/artifacts/`.

## Protección de los datos

El runner crea nombres aleatorios `cup_test_<fecha>_<identificador>` para cada suite MySQL y elimina solamente esas bases al terminar. Nunca ejecuta migraciones ni escrituras de prueba en `smokydev`. El usuario de MySQL necesita permisos para crear y eliminar bases de prueba; si no los tiene, la suite falla en lugar de usar otra base.

La integración también se ejecuta en SQLite en memoria. El navegador usa exclusivamente `tests/artifacts/browser.sqlite`. El SQL histórico de prueba es sintético, generado automáticamente; no hace falta subir respaldos reales ni credenciales al repositorio.

Se comprueban reintentos idempotentes simultáneos, conflictos de versión, independencia de partidos y lecturas concurrentes. Los tiempos reportados son mediciones locales de humo, no una garantía de capacidad del hosting durante el evento.

## Push y pull request

`.github/workflows/checks.yml` ejecuta los controles en GitHub Actions en cada push y pull request, combinando PHP 8.2/8.4 con MySQL 8.0/MariaDB 10.11 en servicios temporales. La regresión de navegador se ejecuta una vez en la matriz. No se usan credenciales del servidor real ni se despliega el sitio.

El check agregado se llama **integration-gate**. Para impedir que se integre código con fallos, configurar ese check como obligatorio en las reglas de la rama principal y exigir pull request. Un workflow por sí solo informa el fallo; la protección de rama es la que impide integrar.

No se encontró `.git` ni un remoto en la carpeta entregada, por lo que no se activaron reglas remotas ni se ejecutó ningún push. Si se usa otro proveedor, habrá que trasladar este mismo comando a su sistema de CI.

Para bloquear localmente un push que falle las pruebas, ejecutar dentro del repositorio Git real:

```text
git config core.hooksPath .githooks
```

En Linux/macOS el hook debe quedar ejecutable. Al incorporarlo al repositorio, registrar ese permiso (también se puede hacer desde Git en Windows):

```text
git add .githooks/pre-push
git update-index --chmod=+x .githooks/pre-push
```

Si ya se utiliza otro directorio de hooks, integrar el contenido de `.githooks/pre-push` en el hook existente en lugar de reemplazar su configuración. El hook ejecuta `python tools/check.py --mysql`. Cada clon debe instalarlo; el workflow remoto es la verificación compartida. Los archivos de hooks usan saltos LF mediante `.gitattributes`.

## Límites

Las bibliotecas PHP antiguas de Quform están retiradas y bloqueadas para acceso web; el lint excluye esas bibliotecas y respaldos privados. Si se vuelven a activar, deben actualizarse y entrar en las verificaciones.

El CI verifica aplicación, migraciones y recorridos; no valida credenciales SMTP reales, reglas del hosting ni capacidad de producción. Antes de desplegar siguen siendo necesarias una prueba de configuración en el hosting, un respaldo y una verificación de entrega de correo.
