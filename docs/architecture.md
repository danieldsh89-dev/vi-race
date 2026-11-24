# Arquitectura

`packages/contracts`: contratos Zod y modelos públicos. `domain`: rúbrica, puntuación, dependencias, frescura y clasificación. `collectors`: GitHub HTTP secuencial, límites, reintentos y paginación. `radar` mantiene candidatos y decisiones. `dna` propone parentescos explícitos del proveedor sin fusionar forks. `analyst` solo valida propuestas y ofrece plantillas; no contiene un proveedor de IA habilitado.

`storage` implementa SQLite local y D1 REST para los jobs. `scripts/pipeline.ts` coordina configuración, revisión, recolección, persistencia y publicación. No usa la respuesta de un README como instrucciones ni ejecuta código externo.

La web lee primero `/fallback/latest.json` y después intenta `VITE_API_URL/api/v1/latest` si se ha configurado. Las actualizaciones sustituyen el conjunto completo. Se consulta cada 120 segundos mientras la pestaña está visible y hay conexión, con espera creciente ante fallos. El botón respeta un límite local de 15 segundos. Los visitantes no disparan trabajos de recolección.

El Worker admite las rutas `/api/v1` del documento y únicamente GET/OPTIONS. Valida rutas, parámetros, CORS y tamaño, emite ETag y caché y devuelve errores sin trazas. No tiene token de escritura ni llamadas a proveedores.

Los workflows de monitorización, mantenimiento y despliegue comparten `vi-race-writer` y no cancelan escrituras en curso. La programación se habilita explícitamente tras configurar cuenta y revisar coste; no se confunde preparación con dos ejecuciones programadas observadas.

La migración SQLite y el contrato de D1 están cubiertos localmente. La atomicidad del endpoint batch remoto y los límites efectivos de una cuenta se deben verificar en integración antes de producción.
