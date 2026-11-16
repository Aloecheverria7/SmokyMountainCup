# Smoky Mountain System

Modernización de Smoky Mountain Cup con NestJS, React y TypeScript. La landing conserva el markup, los estilos y recursos del PHP de referencia; no se ha rediseñado.

## Estado actual

- SPECS del dominio, arquitectura, migración y aceptación en [docs/specs](docs/specs/README.md).
- Monorepo npm: API NestJS y web React/Vite, con CI.
- Landing con CSS/imágenes originales, polling compartido, filtros, banda con pausa, pósteres y formularios; About/Gallery/Contact portados desde PHP.
- Acceso de administrador/anotador, sesiones persistidas y revocables, contraseñas Argon2id, cambio obligatorio inicial, gestión de personal y auditoría.
- Panel de temporadas, competiciones A/B, equipos, jugadores/plantillas, sedes/canchas, sorteos, calendario y anotación con permisos y reintentos sin duplicados.
- Clasificación oficial/provisional, goleadores, eliminatorias con pases libres, penales, reapertura y reconstrucción de rondas.
- Centro público conectado al sistema nuevo mediante PUBLIC_DATA_SOURCE=system, conservando el feed legacy por defecto.
- Migración versionada de la base nueva y CLI para crear el primer administrador, sin credenciales predeterminadas.
- Adaptador **solo lectura** opcional sobre una copia del legacy y herramientas de inspección/planificación del SQL; no modifican producción. Ver [reconciliación](docs/RECONCILIACION.md).
- SMTP con TLS, validación, CSRF y rate limit; sin configuración responde error, nunca éxito simulado.

**Pendiente:** persistencia de medios/pósteres, importación/reconciliación definitiva, OpenAPI completo y despliegue. No se han asignado equipos reales ni reconciliado estadísticas. Ver [operación deportiva](docs/SPORTS.md) y [estado de implementación](docs/BOOTSTRAP.md).

## Desarrollo

Node.js 24 y npm. Desde la raíz:

```sh
npm ci
cp .env.example .env
# Completar APP_ORIGIN y CSRF_SECRET con secreto aleatorio >=32 caracteres.
npm run dev
```

Para preparar MySQL y el primer administrador, seguir [ADMIN.md](docs/ADMIN.md). La API no ejecuta migraciones al arrancar.

Web: http://127.0.0.1:5173. Panel: http://127.0.0.1:5173/admin/. API: http://127.0.0.1:3000/api/v1/health/live.
Con PUBLIC_DATA_SOURCE=legacy y sin conexión legacy configurada, resultados devuelve 503 y la landing conserva el aviso de desconexión del PHP. Para consultar datos, usar usuario de MariaDB con **solo SELECT**, contra copia aislada de la base; completar LEGACY_DB_* en `.env`. No incluir el dump operativo en Git. No se incluye configuración de producción: escucha local, sin proxy confiable ni escalado del rate limiter. En producción se requiere reverse proxy HTTPS, limitador compartido, despliegue del build y revisión de seguridad.

```sh
npm run typecheck
npm run build
npm test
npm run test:api
npm run test:admin
# Solo frontend con fixtures (omite los escenarios administrativos):
npm run test:e2e
# Referencia fijada del sitio publicado, sin conectar producción:
npm run build
npm run test:parity
# Comparador histórico, solo para el checkout PHP anterior:
LEGACY_ROOT=/ruta/SmokyMountainCup npm run test:parity:legacy
```

El E2E usa Chrome local (CHROME_PATH opcional). La comparación visual usa capturas públicas fijadas y el build NestJS/React local con CSP activa, sin base ni envío externo. El comparador histórico del PHP queda separado. Capturas y reporte quedan en artifacts, excluido de Git. Ver [estado y validación](docs/BOOTSTRAP.md).

## Reglas confirmadas

Infantil, Junior, Adulto y Femenino: cuatro competiciones independientes, cada una con grupos A y B. La landing debe conservar apariencia y funcionalidad. Falta confirmar la fecha de corte y el reglamento vigente. Decisión confirmada: continuar la edición actual y reconciliarla; no crear edición nueva ni archivarla automáticamente. Mapeo confirmado: Infantil A/B = 6–9/10–11, Junior A/B = 12–13/14–17; Categoria A completa → Adulto A y Categoria B completa → Adulto B; Femenil conserva A/B.

Ensayo de importación y reconciliación en MySQL desechable: `npm run test:imports`. Los comandos de lotes y sus límites se describen en [RECONCILIACION.md](docs/RECONCILIACION.md); la edición importada no se activa ni publica automáticamente.

Las cifras estadísticas actuales se conservan como base inicial revisada, por decisión del propietario; los resultados nuevos se suman sin recalcular ni borrar esa base.

Despliegue preparado para Hostinger Node.js: [HOSTINGER.md](docs/HOSTINGER.md). `npm run package:hostinger` genera un ZIP privado con builds y manifiesto; `npm start` sirve React/API juntos cuando SERVE_WEB=1. No ejecuta migraciones ni cambia el sitio PHP.

La réplica pública se valida contra capturas del dominio obtenidas el 14 de noviembre de 2026: [PUBLIC-SITE-PARITY.md](docs/PUBLIC-SITE-PARITY.md). `npm run test:parity` compara 19 páginas a cuatro anchos (360, 390, 768 y 1440) usando referencias locales fijadas. La referencia PHP rediseñada anterior no se considera prueba de identidad con el sitio publicado.

La landing consulta los datos que guarda el panel: [integración pública](docs/PUBLIC-DATA.md). Para mostrar una edición deben estar configuradas la base nueva, la temporada activa y las competiciones publicadas. Los valores capturados del tema no se usan como respaldo ante fallos de API.
