# Smoky Mountain Cup — SPECS de modernización

Fecha: 9 de noviembre de 2026. Estado: propuesta v0.1 para revisión de producto y posterior implementación.

Objetivo: sustituir la aplicación PHP por backend NestJS y frontend React, conservando los datos suministrados y las capacidades de operación del torneo comprobadas en el código actual.

## Lectura

1. [Análisis del sistema actual](01-sistema-actual.md): evidencia, capacidades y limitaciones.
2. [Requisitos funcionales](02-requisitos-funcionales.md): alcance, roles, reglas y aceptación.
3. [Arquitectura y API](03-arquitectura-api.md): módulos, contratos y concurrencia.
4. [Datos y migración](04-datos-migracion.md): entidades, transformación y reconciliación.
5. [Entrega y decisiones](05-entrega-decisiones.md): hitos, pruebas y preguntas pendientes.
6. [Auditoría de datos](legacy-data-audit.json): conteos y anomalías comprobados en el SQL.

## Convenciones y límites

- **Actual**: observado en archivos de este checkout. No implica comprobación en producción.
- **Requisito**: comportamiento que la versión nueva debe implementar para mantener paridad.
- **Propuesta**: decisión técnica o funcional sugerida, pendiente de validación.
- **Pendiente**: falta información para cerrar una decisión; no debe inventarse durante la implementación.

Se toma `u460493799_smokyOriginal.sql` como la base actual proporcionada por el propietario. No se interpreta como datos de prueba. Que el PHP tenga un importador que la archive como “Historical import” es una decisión del código existente y no demuestra que el negocio quiera archivarla.

El propietario confirmó el 9 de noviembre de 2026 que el SQL suministrado corresponde a la base operativa actual. Esta estructura de siete tablas es la fuente de migración confirmada. Las tablas `cup_*` están definidas en el PHP, pero no forman parte de la base suministrada; sus funcionalidades son referencia de capacidades, no evidencia de datos operativos que deban importarse. No se consultó una base remota ni se modificó el PHP, el SQL o sus datos. No se ejecutaron las suites históricas: sus resultados publicados no se presentan como verificación de esta revisión.

Por decisión del propietario para Hostinger, el sistema usa MySQL 8.0/8.4 por defecto; MariaDB 11.8 permanece como opción explícita. NestJS y React son requisitos del usuario; herramientas complementarias y despliegue siguen siendo propuestas. Estas SPECS definen contratos y criterios; el OpenAPI ejecutable y las migraciones se entregarán durante la implementación.

## Organización deportiva confirmada

El propietario confirmó cuatro competiciones independientes: **Infantil, Junior, Adulto y Femenino**. Cada una mantiene inscripciones, plantillas, grupos, fixtures, clasificación, goleadores y campeón propios por edición. No hay cruces ni avance de ganadores entre ellas. Cada competición tiene dos grupos internos, A y B: Infantil A/B, Junior A/B, Adulto A/B y Femenino (Fem) A/B. Son ocho grupos en total; A y B no son competiciones independientes. Sus edades y reglas se configuran por separado. El mapping desde el SQL está confirmado por el propietario y se detalla abajo.

## Landing existente: conservación obligatoria

El propietario solicita migrar la landing actual a React sin ningún cambio de diseño o funcionalidad. Se conservarán apariencia, contenido, recursos, distribución responsive e interacciones, usando el PHP renderizado como referencia. No se realizará un rediseño. Ver RF-11A y QA-27. Este requisito prevalece sobre propuestas visuales o de flujo público incompatibles.

## Seguimiento de implementación

Estas SPECS describen el alcance objetivo. El progreso de la implementación en este repositorio se registra en [BOOTSTRAP.md](../BOOTSTRAP.md); la existencia de una especificación no implica que su módulo ya esté implementado.

## Continuidad y correspondencia de datos confirmadas

El propietario eligió **continuar la edición operativa actual y reconciliar sus datos**, sin crear una edición nueva ni archivarla automáticamente. La correspondencia de los grupos originales es:

| Origen SQL | Competición destino |
| --- | --- |
| Juvenil · 6–9 y 10–11 años | Infantil |
| Juvenil · 12–13 y 14–17 años | Junior |
| Categoria A y Categoria B | Adulto |
| Femenil | Femenino |

Mapeo A/B confirmado: Infantil A = 6–9, Infantil B = 10–11, Junior A = 12–13 y Junior B = 14–17. Toda Categoria A se reúne en Adulto A y toda Categoria B en Adulto B; Femenil conserva sus grupos A/B. Esta correspondencia de datos no define por sí sola fecha de corte ni elegibilidad automática de jugadores nuevos. Ver [reconciliación](../RECONCILIACION.md).

Política estadística confirmada: conservar las cifras actuales como base inicial revisada y sumar únicamente resultados nuevos, manteniendo las discrepancias originales y su procedencia. No reconstruir ni inventar los partidos ausentes.

## Corrección de referencia visual — 14 de noviembre de 2026

La fuente de verdad de la landing es el sitio público https://smokymountaincup.com/ y sus subpáginas, no el PHP local rediseñado que se usó antes. La comprobación anterior contra el checkout local no valida el dominio publicado. Se restauran en React el tema, recursos y motores de animación observados en producción. Ver [PUBLIC-SITE-PARITY.md](../PUBLIC-SITE-PARITY.md) para inventario de 19 páginas, recursos, diferencias corregidas y límites de las comparaciones.
