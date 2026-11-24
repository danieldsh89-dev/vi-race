# Fuentes y límites

Adaptador inicial: GitHub REST sobre HTTPS y dominio `api.github.com`, sin ejecutar repositorios. Cursores, fechas, ID de proveedor, ETag y Last-Modified; peticiones secuenciales y máximo de dos reintentos transitorios. Se respetan Retry-After y cuota restante. Los 403 de permisos no se reintentan, y un 404 conserva cursor y capacidades.

El baseline de un repositorio nuevo recoge hasta 30 días de commits; las releases se paginan hasta el cursor o el límite de trabajo. Un lote que no termina la paginación no avanza cursor. Las búsquedas acotadas no prometen cobertura exhaustiva. Registrar repositorios por ID estable antes de admitirlos. Radar conserva rechazados, duplicados y aplazados al redescubrirlos.

Feeds, Reddit y plataformas adicionales están desactivados. Falta revisar condiciones y construir sus adaptadores antes de habilitarlos. Issues, PRs, diffs de README y huellas avanzadas no forman parte del adaptador mínimo actual.

Documentación oficial consultada en esta implementación:

- [GitHub REST: buenas prácticas](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).
- [Worker: precios y plan Free](https://developers.cloudflare.com/workers/platform/pricing/).
- [D1: precios](https://developers.cloudflare.com/d1/platform/pricing/).
- [D1: consulta REST y batch](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
- [Worker: configuración Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/).
- [Worker: prácticas oficiales](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).

Estos documentos sustentan la configuración; no acreditan el plan de la cuenta de destino. Al desplegar deben revisarse de nuevo los recursos y cuotas compartidas. No activar sobrecostes ni IA para resolver un límite.
