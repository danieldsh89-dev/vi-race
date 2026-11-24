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

Pendiente para automatización: credenciales separadas de datos y despliegue en el entorno `production` de GitHub, dos ejecuciones programadas observadas, mantenimiento y restauración remota. `VI_RACE_ENABLED` continúa en false; una URL pública todavía no acredita monitorización automática.
