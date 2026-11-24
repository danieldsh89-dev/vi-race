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

## Política de enlaces

Decisión del propietario (24-11-2026): **rastrear sin enlazar**. Muchas rutas de GTA VI en PC dependen de una compilación filtrada de la versión de Xbox Series, y gran parte de los resultados de búsqueda son reclamos. VI Race observa y documenta estos proyectos, pero la web no los promociona con hipervínculos:

- Radar nunca enlaza candidatos. Muestra la URL del repositorio como texto para que se pueda verificar.
- Un proyecto admitido se muestra sin enlaces (`link_policy` ausente o `"text_only"`) en ficha, evidencias, fuentes y actividad. Solo `link_policy: "link"`, registrado en revisión, activa los hipervínculos. Requiere comprobar que el proyecto no depende de material filtrado ni lo distribuye.
- Nunca se publican enlaces, hashes ni instrucciones para obtener material del juego. La versión objetivo se identifica con datos que ya declara el propio proyecto.
- Si un repositorio se retira por una reclamación, se conserva su historial y se marca como no disponible. No se enlazan copias de rescate ni resubidas.

La API y los respaldos conservan las URL como datos para la trazabilidad. La política se aplica a la presentación.
