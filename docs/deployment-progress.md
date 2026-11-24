# Progreso de conexión y despliegue

## 24 de noviembre de 2026 — GitHub

El propietario completó el acceso de GitHub CLI. Cuenta comprobada mediante la API: `danieldsh89-dev`, ID público `287736018`. Es distinta de la cuenta del conector utilizado en la primera comprobación; se usa la sesión que el propietario acaba de autorizar.

Repositorio creado y visibilidad pública comprobada: https://github.com/danieldsh89-dev/vi-race. CODEOWNERS y mantenedor se han ajustado a esa identidad. Las acciones externas se limitan a acciones propiedad de GitHub. El despliegue y la monitorización quedan deshabilitados hasta verificar Cloudflare y completar recursos y variables.

Antes de subir código: escaneo de patrones de credenciales sin coincidencias y `npm run check` correcto, con 74 pruebas, tipos y compilación. Los secretos, base local, metadatos de sesiones y archivos de prueba están excluidos por `.gitignore`.

## Cloudflare

La revisión automática rechazó inicialmente el alcance persistente de toda la cuenta. El propietario lo autorizó explícitamente para información de cuenta y escritura en Workers, D1 y Pages, con uso limitado a VI Race y sin servicios de pago.

Se inició el flujo oficial de autorización de dispositivo de Wrangler, con almacenamiento de credenciales en el llavero del sistema. No se guardan códigos de dispositivo ni credenciales en el repositorio.

El propietario mostró la pantalla de Planes de Workers con Gratuito / 0 US$ marcado como Plan actual. La captura de Workers y Pages muestra la misma cuenta identificada por Wrangler. La lista D1 estaba vacía y Pages solo tenía el proyecto GameVault antes de esta instalación.

Recursos nuevos y exclusivos: base D1 `vi-race` (`98b0d87c-282c-45e8-8d9f-dc980102cf1e`), Pages `vi-race` y Worker `vi-race-api`. No se ha modificado GameVault. Los registros de verificación están en `config/deployment.json` y las funciones opcionales de pago siguen apagadas.

Las cuatro migraciones se aplicaron en D1 remoto. La primera carga pública se generó desde un respaldo restaurado y validado localmente, mediante `scripts/export-bootstrap.ts`; solo admite un destino vacío. D1 importó 71 consultas y confirmó integridad referencial sin errores, publicación actual y hash. Tamaño tras la carga: 516.096 bytes. No se importó la demostración.

La autorización inicial necesitó renovación con el permiso específico `workers_scripts:write`, dentro del alcance ya aprobado por el propietario. Tras completar esa renovación, el Worker se publicó correctamente. Versión inicial: `9a6cd556-b405-401d-a278-41136f11c7b2`.

Web pública: https://vi-race.pages.dev/

API de lectura: https://vi-race-api.danieldsh89.workers.dev/api/v1/latest

Se comprobó HTTP 200, publicación coherente con el respaldo, 30 candidatos sin admitir, CORS del sitio y rechazo de POST con 405. El primer despliegue estático fue `b8c7da56`; el despliegue conectado a la API fue `795cd913`. La primera CI remota detectó bajo contraste en el tema claro; se corrigió y la siguiente ejecución `45401482008` terminó correctamente. La prueba ampliada comprueba el tema claro en las siete pantallas principales.

La compresión de Cloudflare convierte ETag en una etiqueta débil. Se añadió comparación GET compatible con etiquetas débiles, listas y comodín, con tres casos de regresión; comprobación real posterior: HTTP 304. Suite local actual: 80 pruebas.

Claude revisó de forma estática la importación y la API sin encontrar bloqueantes con los datos utilizados. Se amplió además el rechazo estructural de datos sintéticos a todas las tablas y cuerpos JSON del respaldo, incluidas publicaciones anteriores. La importación inicial por fichero no se anuncia como una transacción global: si se interrumpe y deja un destino parcial, la guarda impide mezclar otro intento. Recuperar desde la copia local verificada hacia una base nueva vacía y volver a comprobar integridad y publicación antes de cambiar el binding. No borrar ni sobrescribir la base parcial automáticamente.

## Automatización y recuperación

El secreto de datos se guardó directamente en el entorno `production` de GitHub. Sus valores nunca se leen ni se muestran desde esta sesión. El primer monitor manual detectó un fallo del lector de JSONC ante una coma final válida de Wrangler; se corrigió con `jsonc-parser` y tres casos de regresión. La ejecución manual `45406517300` terminó correctamente y publicó en D1 a las 13:45:01 UTC: 32 candidatos pendientes, cero proyectos admitidos. `VI_RACE_ENABLED=true`; la programación está activa, pero todavía no se han observado dos ejecuciones de evento `schedule`.

El despliegue automático `45406513634` exportó datos y compiló correctamente, pero se detuvo por faltar `CLOUDFLARE_DEPLOY_TOKEN`. La credencial de despliegue debe guardarse aparte en el mismo entorno. Se añadieron interruptores separados `VI_RACE_DEPLOY_ENABLED` y `VI_RACE_MAINTENANCE_ENABLED` para habilitar esas tareas al terminar su configuración.

Se creó D1 `vi-race-restore-check` (`53de1fa0-dbc7-44cb-832b-b156c455582e`) exclusivamente para un ensayo de recuperación, sin modificar la base publicada. El workflow manual prepara sus migraciones y usa el mismo adaptador REST de producción. El SQL de bootstrap también se expone como lista de statements, conservando los puntos y comas dentro del texto. Las comprobaciones locales actuales pasan: 84 pruebas, tipos y compilación. El resultado remoto del ensayo sigue pendiente.

## Despliegue automático y recuperación remota (verificado)

`CLOUDFLARE_DEPLOY_TOKEN` se guardó en el entorno `production` (13:57 UTC) y se activó `VI_RACE_DEPLOY_ENABLED=true`. La ejecución manual `45408906094` exportó, compiló y publicó Pages correctamente: despliegue `b0192c3b`. Comprobación posterior desde esta sesión: web HTTP 200, API HTTP 200 con la publicación `pub_20261124134501087_0544bebf` y POST rechazado con 405.

La ejecución manual `45408605441` de `Verificar recuperación D1` terminó correctamente sobre `vi-race-restore-check`: rollback de lote fallido verificado, restauración verificada, checksum `ba7f8878…f314ba`, publicación actual coincidente y 0 errores de claves foráneas. Esa base ya no está vacía; un nuevo ensayo exige otro destino vacío.

`last_collection_success_at` es `null` por diseño: solo se calcula con fuentes admitidas y el catálogo real sigue vacío.

## Revisión de campos del respaldo

Revisión de solo lectura de D1 producción (24-11-2026, 14:05 UTC): 32 candidatos con metadatos públicos de GitHub (ID, URL, nombre, descripción, consulta y fechas), 3 ejecuciones con commit, métricas y error resumido, estado de descubrimiento con cursor y fechas. `source_state`, `audit_log` y `usage_daily` vacíos. No hay credenciales, correos ni datos personales más allá de nombres de cuentas públicas de GitHub ya visibles en la web. `publish-backup.mjs` vuelve a rechazar patrones de tokens antes de publicar.

## Mantenimiento (verificado)

Con autorización del propietario se activaron `VI_RACE_PUBLIC_BACKUP=true` y `VI_RACE_MAINTENANCE_ENABLED=true` como variables de repositorio (las condiciones `if:` de los jobs no leen variables del entorno). La ejecución manual `45410989396` terminó correctamente: respaldo normalizado de 320.428 bytes verificado por restauración local, 0 publicaciones retiradas, rama `backups` creada sin force push con `daily-2026-11-24.json`, respaldo estático regenerado y Pages desplegado (`c47d5908`).

Pendiente: observar y registrar dos ejecuciones de evento `schedule`. A las 14:11 UTC todavía no había ninguna; GitHub puede tardar en activar la programación de un repositorio nuevo. Una URL pública y ejecuciones manuales no acreditan por sí solas la programación.
