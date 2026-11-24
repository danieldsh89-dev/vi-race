# VI Race

Observatorio comunitario de proyectos relacionados con GTA VI en PC. Muestra actividad, evidencias y capacidad confirmada por separado. Proyecto independiente y no oficial.

## Abrir en tu ordenador

Necesitas Node.js 24 LTS y npm. En PowerShell, dentro de esta carpeta:

```powershell
npm ci
npm run build
npm run dev
```

Abre la dirección que imprime Vite (normalmente `http://127.0.0.1:5173`). El catálogo real empieza vacío. Para recorrer fichas y clasificación con ejemplos ficticios abre `/?demo=1`; la cabecera lo indica en todas las pantallas. No son descubrimientos reales.

Si el puerto está ocupado: `npm run dev -- --port 5175`.

## Qué está construido

React/TypeScript/Vite con dashboard, catálogo y filtros en URL, ficha con 20 hitos y evidencias, Radar, comparador de hasta tres rutas, metodología, fuentes, estado, temas oscuro/claro y respaldo estático. Dominio determinista, recolección incremental GitHub, persistencia SQLite/D1, decisiones versionadas, publicaciones atómicas, restauración local y workflows preparados. IA desactivada.

## Comprobar

```powershell
npm run check
npm run api:build
npm run test:e2e
```

En Windows las pruebas de interfaz usan Edge instalado. En Linux/CI: `npx playwright install --with-deps chromium`. No hace falta abrir ni ejecutar software de los proyectos observados.

`npm run check` valida configuración, tipos, pruebas, compilación y presupuestos. `npm run api:build` solo empaqueta el Worker con `--dry-run`; no lo despliega. `npm run maintenance` exporta un respaldo normalizado y lo restaura en una base local antes de conservarlo.

## Seguimiento y publicación

`npm run monitor` consulta GitHub y guarda los resultados en `.local/vi-race.sqlite`. Necesita red; es una operación real, no una prueba sintética. No añade proyectos automáticamente: los candidatos quedan en Radar. `npm run export:static` vuelve a generar la copia que se sirve cuando no hay API. El polling del navegador solo consulta publicaciones compartidas; nunca lanza búsquedas.

La API Worker usa D1 por binding y solo admite lecturas. Actions escribe por la API de infraestructura con credenciales acotadas, separadas del token de despliegue. No hay administración pública.

**Todavía no se declara desplegado ni verificado en producción.** Sigue [el manual](docs/operations.md) para conectar GitHub y una cuenta gratuita de Cloudflare. No introduzcas secretos en archivos ni en variables `VITE_*`.

Lee [ROADMAP.md](ROADMAP.md), [la arquitectura](docs/architecture.md), [la metodología](docs/methodology.md), [el documento maestro](VI_RACE_DOCUMENTO_MAESTRO.md) y [el registro de entrega](docs/delivery.md) para conocer evidencias y límites concretos.
