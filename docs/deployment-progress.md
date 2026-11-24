# Progreso de conexión y despliegue

## 24 de noviembre de 2026 — GitHub

El propietario completó el acceso de GitHub CLI. Cuenta comprobada mediante la API: `danieldsh89-dev`, ID público `287736018`. Es distinta de la cuenta del conector utilizado en la primera comprobación; se usa la sesión que el propietario acaba de autorizar.

Repositorio creado y visibilidad pública comprobada: https://github.com/danieldsh89-dev/vi-race. CODEOWNERS y mantenedor se han ajustado a esa identidad. Las acciones externas se limitan a acciones propiedad de GitHub. El despliegue y la monitorización quedan deshabilitados hasta verificar Cloudflare y completar recursos y variables.

Antes de subir código: escaneo de patrones de credenciales sin coincidencias y `npm run check` correcto, con 74 pruebas, tipos y compilación. Los secretos, base local, metadatos de sesiones y archivos de prueba están excluidos por `.gitignore`.

## Cloudflare

La revisión automática rechazó inicialmente el alcance persistente de toda la cuenta. El propietario lo autorizó explícitamente para información de cuenta y escritura en Workers, D1 y Pages, con uso limitado a VI Race y sin servicios de pago.

Se inició el flujo oficial de autorización de dispositivo de Wrangler, con almacenamiento de credenciales en el llavero del sistema. No se guardan códigos de dispositivo ni credenciales en el repositorio.

Pendiente: comprobar la autorización, identificar la cuenta, verificar el plan gratuito y cuotas, crear recursos exclusivos, configurar permisos del pipeline, desplegar y observar dos ejecuciones programadas. Ninguna de estas comprobaciones se presume terminada por haber iniciado el acceso.
