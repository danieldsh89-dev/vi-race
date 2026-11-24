# Operación y publicación gratuita

## Uso local

`npm ci`, `npm run check` y `npm run dev`. La vista normal muestra los últimos candidatos reales recopilados localmente y un catálogo vacío. La demostración independiente está en `/?demo=1`. El estado local se guarda en `.local/`, ignorado por Git. No hay secretos en la web.

`npm run monitor` hace llamadas reales a GitHub. Con `GITHUB_TOKEN` de Actions se usa la cuota de ese workflow; sin token se usa la cuota pública, más baja. `npm run export:static` actualiza la lectura de respaldo. `npm run maintenance` conserva una copia normalizada y comprueba su restauración antes de aplicar retención.

## Pasos pendientes para publicar

1. Iniciar sesión del propietario con `gh auth login` y `node scripts/wrangler.mjs login`. Son sesiones de GitHub y Cloudflare; no son claves de modelos de IA. No pegar contraseñas ni tokens en el chat. El conector de GitHub reconoce una cuenta, pero no puede crear repositorios con las herramientas disponibles; la CLI no tiene sesión comprobada al entregar.
2. Revisar en Cloudflare que Workers y D1 usan el plan Free, sin facturación de excesos habilitada y con cuota libre suficiente. Revisar las cuotas compartidas, Pages y que el repositorio de Actions será público. No usar una cuenta facturable sin resolver antes el requisito de coste cero. No se ha realizado esta revisión todavía.
3. Crear un repositorio público independiente, por ejemplo `vi-race`, y recursos exclusivos: D1 `vi-race`, Worker `vi-race-api`, Pages `vi-race`. Comandos preparados en Wrangler: `node scripts/wrangler.mjs d1 create vi-race` y `node scripts/wrangler.mjs pages project create vi-race --production-branch main`. No se han ejecutado aquí.
4. Copiar el ID real de D1 a `apps/api/wrangler.jsonc`, definir el origen `https://<proyecto>.pages.dev` en `ALLOWED_ORIGINS` y mantener localhost solo en desarrollo. Actualizar CSP si se elige un dominio de API distinto de `*.workers.dev`.
5. Registrar recursos, responsable y fecha de comprobación en `config/deployment.json`. Marcar las tres verificaciones como true solo tras la revisión de cuenta. `npm run deploy:check` bloquea una configuración incompleta. Un booleano es un registro de revisión, no una comprobación automática del plan.
6. Aplicar migraciones con la programación todavía desactivada: `node scripts/wrangler.mjs d1 migrations apply vi-race --remote --config apps/api/wrangler.jsonc`. Toda migración futura debe detener primero workflows escritores o ejecutarse bajo el mismo bloqueo `vi-race-writer`. Hacer respaldo antes de cambios destructivos.
7. Configurar el entorno protegido `production` en GitHub. Variables: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `VI_RACE_API_URL`, `VI_RACE_PAGES_PROJECT`. Secretos separados: `CLOUDFLARE_DATA_TOKEN` con D1 acotado y `CLOUDFLARE_DEPLOY_TOKEN` con los permisos mínimos de Worker/Pages. Si el proveedor no permite restringirlos por recurso, documentar el alcance efectivo. No usar tokens de IA ni servicios de pago.
8. Añadir mantenedor en `config/reviewers.json` y protección de rama/CODEOWNERS para configuración, revisiones, dominio y workflows. Los revisores retirados se conservan en `historical_reviewers` con `from`/`until` para que su aprobación histórica no desaparezca.
9. Revisar que todos los campos de respaldo son publicables y activar `VI_RACE_PUBLIC_BACKUP=true`. `VI_RACE_ENABLED=true` habilita la recogida; `VI_RACE_DEPLOY_ENABLED=true` y `VI_RACE_MAINTENANCE_ENABLED=true` habilitan cada job solo cuando sus credenciales estén guardadas. Ejecutar monitorización manual, desplegar y comprobar la URL, CORS, respuesta D1, respaldo con API caída y restauración. Los jobs usan runner Linux estándar. Ninguna visita ejecuta un job.
10. Observar y registrar **dos ejecuciones programadas**, además de las manuales, antes de declarar F05 terminada. Revisar métricas reales de filas, almacenamiento y tráfico. La programación puede retrasarse y se puede desactivar tras 60 días sin actividad; comprobarla sin crear commits artificiales.

## Fuentes, revisión y puntos

Las consultas de `config/discovery.json` rotan si se alcanza el límite de candidatos de un ciclo. Se mantiene la siguiente consulta y la espera de cuota. No hay una promesa de cobertura completa. El rechazo de una búsqueda no vacía los resultados anteriores.

Para admitir un candidato, revisar su identidad y alcance, registrar proyecto y versión en `config/projects.json`, fuente con ID estable en `config/sources.json` y decisión en `reviews/`. Revisar los términos y la procedencia pública. No confirmar avances con nombres, estrellas, anuncios o IA.

Las confirmaciones se añaden como evaluaciones con material E2 y E3 independiente o un informe propio de otro revisor autorizado, separado del autor de la demostración y del aprobador. Usar el SHA completo de un commit de revisión anterior para evitar autorreferencia. El registro pasa por revisión de GitHub; el pipeline no certifica que una persona haya pulsado aprobar solo porque un campo contiene su nombre.

## Copias, retención y recuperación

El respaldo normalizado incluye identidades, eventos, evaluaciones, evidencia, puntuación y publicaciones, con versión de esquema y SHA-256 canónico. Se restaura en una base vacía con todas las migraciones, verifica claves foráneas y compara el contenido completo. Restaurar sobre una base no vacía se rechaza. La copia estática de Pages es otra cosa: sirve para seguir leyendo, sin sustituir este respaldo.

Mantenimiento conserva siete copias diarias y cuatro semanales, con techo conjunto de 100 MB. El workflow carga la rama `backups`, añade la copia verificada y la publica sin force push. Comprueba el tamaño de objetos Git y se detiene antes de continuar si excede el presupuesto; la compactación de historial requiere una copia verificada y un procedimiento revisado. Para este primer volumen, cada exportación tiene un techo de 25 MB; superar ese tamaño exige implementar bloques antes de seguir.

Se mantienen al menos las dos últimas publicaciones y las de las últimas 24 horas. Los detalles de eventos sin uso en afirmaciones se compactan a los 30 días y la actividad a los 90; las referencias necesarias para afirmaciones no se eliminan. Diagnósticos de jobs: 30 días salvo referencias; métricas: un año. Identidades, evidencias, decisiones y puntuaciones no se purgan. La actividad pública se cuenta por los últimos 7 y 30 días de calendario UTC, con agregados actualizados idempotentemente en el mismo lote del evento y cursor.

Para restaurar: conservar la base afectada, obtener la exportación verificada, aplicar migraciones en una base local vacía y usar `restoreBackup` de `packages/storage`. Ejecutar la comprobación de integridad y comparar puntuaciones/publicaciones antes de cargar una base remota nueva. No reemplazar producción sin verificar el resultado local y el plan gratuito del recurso de destino.

El workflow manual `Verificar recuperación D1` ensaya la recuperación en `vi-race-restore-check`, cuyo identificador debe coincidir en `config/deployment.json` y `VI_RACE_RESTORE_DATABASE_ID`. Comprueba primero un lote correcto y el rollback de un lote fallido, restaura una exportación validada localmente y compara checksum completo, publicación actual y claves foráneas. Comparte el bloqueo escritor con los demás jobs. Solo lee producción; nunca cambia su binding ni su puntero. El destino debe estar vacío: después de una ejecución correcta, otro intento se rechazará. Conservarlo como prueba; para otro ensayo registrar un nuevo destino vacío, sin borrar automáticamente el anterior.

## Incidencias

Detener trabajos con `VI_RACE_ENABLED=false`. Una fuente problemática se deshabilita en configuración. Cuotas: respetar la espera y reducir frecuencia; no contratar más capacidad. Si Worker falla, la web conserva el respaldo y su fecha. Si una publicación es inválida, current no cambia. Para rollback de datos seleccionar una publicación completa anterior bajo el mismo bloqueo escritor; el rollback de código se realiza por separado. Una migración exige respaldo y plan propio.

Pendiente en infraestructura real: métricas de cuenta y comprobación de umbrales diarios. Los límites por ciclo y artefacto son efectivos localmente; no sustituyen el bloqueo de facturación del plan Free.
