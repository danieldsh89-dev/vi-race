# VI Race — Estado de implementación

Actualizado: 24-11-2026. Repositorio público: https://github.com/danieldsh89-dev/vi-race. Primera web pública: https://vi-race.pages.dev/, conectada a Worker y D1. La monitorización programada y el mantenimiento todavía no están acreditados. Estado detallado: `docs/deployment-progress.md`.

| Fase | Implementado y comprobado | Pendiente |
|---|---|---|
| F01 Base | Workspaces npm, TypeScript estricto, contratos Zod, rúbrica normativa, cuatro migraciones, SQLite, puerto D1 REST, decisiones y documentación. Repositorio público creado y código subido; CI remota correcta. | Mantener pruebas en cambios posteriores. |
| F02 Seguimiento | GitHub incremental, presupuesto, paginación, límites HTTP, reintentos, cursores CAS, deduplicación, Radar y forks declarados. Dos ciclos locales reales de Radar correctos; 30 candidatos sin admitir. Dos recogidas reales de GitHub en memoria correctas. | Comprobar D1 remoto y fuentes reales admitidas. Las recogidas reales del ejemplo fueron sin cambios; los cambios y duplicados se prueban con fixtures. |
| F03 Evidencia y puntos | E2/E3 o informe independiente de otro revisor autorizado, historial append-only, rectificaciones, dependencias, hashes canónicos y publicación atómica. Revisión de Claude cerrada y casos añadidos a pruebas. | Registrar mantenedores y revisiones reales con protección de rama; no hay logros reales confirmados. |
| F04 Interfaz | Resumen, catálogo, filtros URL, fichas, evidencia, Radar, metodología, fuentes, estado, comparador, temas, demo separada y lectura estática. Seis recorridos Playwright correctos; axe sin infracciones de las reglas WCAG seleccionadas a 360, 768 y 1440 px. | Medición de rendimiento móvil con perfil de red/CPU; la suite de accesibilidad automatizada no acredita todos los criterios manuales. |
| F05 Publicación | Plan Free mostrado por el propietario, sesiones verificadas, recursos exclusivos creados, migraciones e importación D1 correctas, Worker de lectura y Pages publicados. HTTP, CORS, respaldo y rechazo de escrituras comprobados. | Credenciales de datos y despliegue conectadas; despliegue automático, rollback D1 REST y restauración remota verificados. Mantenimiento con respaldo público verificado. Falta observar dos ejecuciones programadas. No marcar completada. |
| F06 Profundidad | Comparador de hasta tres rutas y parentesco explícito básico. | Huellas técnicas, identidad avanzada, análisis de README, issues, PR y etiquetas. |
| F07 IA | Contrato estricto de propuestas y plantillas; IA apagada y sin proveedor facturable. | Adaptador Workers AI gratuito, cuota real y revisión específica antes de activar. No bloquea el MVP. |
| F08 TechRadar | Fuera del producto y de este repositorio. | Solo se estudiará tras demostrar utilidad real de VI Race. |

## Cambio de dirección (24-11-2026)

Decisión del propietario: panel autónomo de avances, sin revisión manual. Portada nueva «La carrera» con la escalera vi-avance-v1 (P1–P8), actividad de 14 días, línea temporal de avances y embudo por paso; 22 proyectos curados y seguimiento automático desde Radar. Detalle en `docs/progress-ladder.md`. La auditoría vi-pc-v1 se retiró de la web.

## Evidencia de este bloque

- `npm run check`: validación de 20 hitos y 100 puntos, tipos, **74 pruebas** y compilación web correctos.
- `npm run test:e2e`: **6 pruebas** correctas, siete pantallas principales y tamaños 360/768/1440; demo, fichas, filtros, evidencias, comparación, temas y sin red.
- `npm run api:build`: dry run correcto; Worker de aproximadamente 3,83 KiB antes de comprimir. No despliega.
- Presupuesto web: aproximadamente **121.380 bytes de JavaScript gzip** frente al techo de 250 KiB. Sin patrones de secretos detectados en el artefacto.
- `npm run maintenance`: exportación de aproximadamente **222.533 bytes**, importación en SQLite vacío, checksum completo y claves foráneas correctos antes de COMMIT.
- Dos ciclos manuales de Radar: 12:16 y 12:17 UTC, exitosos; el segundo respetó el intervalo y no repitió la búsqueda.
- `npx tsx scripts/smoke-github.ts`: dos recogidas del repositorio público de ejemplo `octocat/Hello-World`, ID estable 1296269; 8 peticiones, segundo ciclo condicional, cero eventos nuevos. Base temporal, sin contaminar catálogo.
- `npm run deploy:check`: rechazo esperado mientras no haya verificación real de planes y recursos.

Los valores exactos del artefacto pueden variar al recompilar. Las capturas y trazas locales se guardan en `test-results/`; las revisiones originales de Claude en `.local/`, sin subir metadatos de sesión. El resumen público de revisión está en `docs/delivery.md`.

## Punto de continuación

Seguir `docs/deployment-progress.md`. Verificado: ciclo manual de datos (`45406517300`), despliegue automático (`45408906094`) y recuperación remota con rollback (`45408605441`). Campos del respaldo revisados como publicables y mantenimiento verificado (`45410989396`). Falta: registrar dos ejecuciones `schedule`. Después, F05 puede cerrarse; F03 sigue requiriendo revisiones humanas reales. No activar facturación ni pedir claves de modelos. Suite actual: 98 pruebas unitarias y 6 E2E.
