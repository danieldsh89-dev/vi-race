# Registro de entrega local — 24 de noviembre de 2026

Este registro conserva la entrega local inicial. Para la primera publicación real posterior, sus comprobaciones y pendientes, consultar [deployment-progress.md](deployment-progress.md).

## Resultado

Se ha construido una aplicación funcional en la carpeta de destino, con la arquitectura indicada por el documento maestro. Se puede abrir localmente y navegar de principio a fin. Radar contiene 30 candidatos obtenidos de una búsqueda pública real; ninguno ha sido admitido ni puntuado. El catálogo real está vacío. Las fichas de ejemplo viven en una demostración inequívocamente etiquetada.

La vista previa de esta sesión usa `http://127.0.0.1:5175/`. Después de cerrar el servidor se vuelve a abrir con `npm run dev -- --port 5175`. La demostración está en `/?demo=1`.

## Implementación

Motor puro con 20 hitos y 100 puntos, dependencias, vigencia por versión y fechas de corte, empate de posición, estados y rectificaciones. Evidencias con procedencia, limitaciones, versión y comprobación humana autorizada. Las entidades sintéticas se rechazan antes de escribir hechos inmutables.

SQLite local y adaptador D1 de infraestructura. Los lotes de eventos, agregados diarios y cursor incluyen CAS. También lo aplica la vía de fallo: un error tardío no puede sobrescribir un cursor nuevo. Publicaciones por versión con comprobación de blobs, hashes, CAS del puntero y conservación de la última válida. El historial admite A → B → A sin perder ocurrencias y es append-only incluso ante DELETE.

UI adaptable, sin cuenta, con siete pantallas de navegación principal, ficha y comparador, filtros en URL, modo claro/oscuro, frescura calculada en el cliente y respaldo cuando la API no está disponible. API pública de lectura con rutas acotadas, CORS, ETag, tamaño y cabeceras de caché. No realiza llamadas a GitHub ni IA.

Cuatro workflows preparados: CI, monitorización, mantenimiento y despliegue. Mismo grupo escritor, timeout, runner estándar, acciones fijadas por SHA, secretos separados y activación condicionada. La preparación de estos archivos no acredita ejecución programada.

## Validación ejecutada

| Nivel | Comprobación | Resultado |
|---|---|---|
| Estático/local | `npm run check` | Correcto: configuración, tipos, 74 pruebas, build y presupuesto de artefacto. |
| Local | `npm run api:build` | Correcto, solo dry run. |
| Local/navegador | `npm run test:e2e` | 6 de 6 correctas. |
| Local/navegador | Axe sobre las siete rutas principales a 360, 768, 1440 px | Sin infracciones en las reglas seleccionadas; comprobación adicional del tema claro. |
| Local/navegador | Sin API, pérdida de red, filtros y navegación a pruebas | Correcto. |
| Local | Respaldo y restauración | Correctos; destino vacío, claves foráneas y contenido completo comprobados antes de confirmar. |
| Integrado limitado | Dos ejecuciones manuales de Radar contra GitHub | Correctas; búsqueda acotada, 30 candidatos, segundo ciclo sin consultas por intervalo. |
| Integrado limitado | Dos recogidas reales contra API GitHub | Correctas en base efímera; sin cambios en el repositorio de ejemplo. No acredita el caso remoto con eventos nuevos. |
| Control de preparación | `npm run deploy:check` | Rechazo esperado: cuenta gratuita y recursos todavía sin verificar. |
| Producción | D1, Pages, Worker, cron, coste real y tráfico | No verificados. |

Capturas: `test-results/dashboard-real-vacio.png`, `dashboard-demo-desktop.png`, `dashboard-demo-mobile.png`. La web usa tipografía de sistema y recursos gráficos propios en CSS; no incorpora imágenes ni archivos del juego.

## Dirección y revisión

Se comprobó la sesión Claude Pro y se consultó la arquitectura. Claude indicó puerto SQL de lotes, cursores y puntero con CAS, hashes canónicos, revisiones humanas y exclusión de fixtures. Codex implementó el conjunto y ejecutó las comprobaciones.

La revisión independiente encontró y se corrigieron: bloqueo por texto externo que contenía la palabra fixture; independencia insuficiente de una demostración; cambios efectivos ausentes en el hash de puntuación; falta de CAS en errores; restauración sobre una base no vacía; repetición de estados en el historial; marcas sintéticas ausentes y control demasiado tardío. Se añadieron casos de regresión y triggers de inmutabilidad. Claude leyó las correcciones finales y dio por cerrados sus bloqueantes. Esa revisión fue de código; los resultados de ejecución corresponden a las herramientas de esta sesión.

## Límites y siguiente trabajo

No hay URL pública, recursos remotos creados, programación observada ni plan de cuenta verificado. La CLI GitHub y Wrangler informan que no están autenticados. El conector GitHub reconoce una cuenta, pero no ofrece creación de repositorios. El siguiente paso necesita las sesiones del propietario y revisión de la cuenta Cloudflare Free; no una clave de IA.

Pendientes técnicos explícitos: verificar atomicidad/triggers y migraciones en D1 real; métricas y umbrales de consumo de cuenta; restauración remota; medición móvil de rendimiento con un perfil documentado; revisión manual de accesibilidad; partición de respaldos por encima de 25 MB; historial Git de respaldo por encima de su presupuesto; adaptadores adicionales y análisis avanzado de código. No se activan servicios de pago para cubrirlos.

No se han realizado commits, push, despliegues, cambios de cuenta ni publicación de proyectos como legítimos. La IA del producto permanece apagada. TechRadar permanece fuera del alcance.

