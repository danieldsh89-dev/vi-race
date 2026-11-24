# 0001 — Puerto SQL de lotes y publicaciones preparadas

Fecha: 2026-11-24. Dirección técnica consultada con Claude Pro; implementación y comprobación en Codex.

Se conserva Actions + Pages + Worker + D1, npm workspaces y dominio TypeScript puro. La alternativa Sites no sustituye el alojamiento expresamente elegido en el documento. La aplicación empieza localmente y no provisiona infraestructura sin comprobar la cuenta gratuita.

`SqlStore` expone query y batch; SQLite local ejecuta los lotes en transacción y D1 REST usa `body.batch` documentado. El Worker no usa el adaptador REST ni Node SQLite. Usa únicamente consultas de lectura por binding D1.

Los campos relacionales e índices necesarios se normalizan; los restantes campos de cada contrato se guardan en `payload_json` validado. No se pierde el diccionario funcional. JSON canónico con claves ordenadas produce hashes reproducibles. Las revisiones conservan campos efectivos y registrados, versión, revisor y commit.

Eventos y cursor se guardan juntos, con comparación del estado leído mediante una tabla guard con CHECK. Un conflicto aborta todo el lote. Una publicación se crea en building, se releen y verifican blobs y hashes, y el último lote marca complete y cambia current comparando el puntero esperado. Los blobs completos son inmutables.

El MVP usa una instantánea principal acotada a 250 KiB con el catálogo, detalles y fuentes necesarios. También prepara rutas por recurso e histórico. El navegador sustituye una instantánea completa; nunca mezcla publicaciones ni necesita resolver enlaces de versiones caducadas. Si supera el presupuesto, se detiene la publicación y se conserva la anterior; el siguiente escalado exigirá separar carga de fichas y recursos, sin elevar el límite silenciosamente.

No se incluyen gráficos en esta primera versión: el histórico se ofrece como tabla exacta, sin interpolación. Recharts y el análisis avanzado quedan para una necesidad demostrada. La demo se exporta a `/demo` desde fixtures propios, nunca a latest ni D1; se rechaza al publicar en producción.
