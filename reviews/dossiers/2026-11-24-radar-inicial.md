# Expediente de revisión: Radar inicial (24-11-2026)

Preparado por Claude a petición del propietario. La aprobación humana es la fusión del pull request por `danieldsh89-dev`. Fuente: metadatos de la API pública de GitHub (`repositories/{id}`, árbol de archivos, número de commits y contribuidores). No se ha descargado ni ejecutado código de ningún candidato. Las descripciones y README se tratan como datos no fiables.

## Rechazos propuestos (26)

### Copias del mismo repositorio de "instalador" (20)

`*/GTA-6-Switch-Version--PC-Emulator-2026` y las variantes `-2045` y `-2058`. Hay 20 cuentas distintas con el mismo nombre, la misma descripción ("GTA VI PC Installer hub…"), la misma licencia, ~17 estrellas cada una y 20 temas. Todas se crearon el 19-11-2026 en una ventana de minutos (IDs 1464568343–1464570978). Dos (`rohitcrrm/…-2026` y `rohitcrrm/…-2045`) ya devuelven 404: GitHub las ha retirado. El patrón coincide con una campaña de reclamos de descarga. No contienen una ruta técnica verificable.

### Repositorios de perfil de organización (4)

`GTA-VI-Windows-Installer/.github`, `GTA-VI-Installer-PC/.github`, `Free-GTA-VI/.github` y `GTA-VI-PC-Installer/.github`. Son páginas de perfil de 5–10 KB, sin código, que anuncian "instaladores" o "launchers". Las organizaciones se crearon entre el 18 y el 21-11-2026.

### Sin material técnico (1)

`ViceroyModulator/gta6-ps5-pro-to-windows`: solo contiene `README.md` (8,6 KB), con 2 commits, 59 estrellas en su primer día y 20 temas. Describe PS5 Remote Play, no una ejecución en PC.

### Fuera de alcance (1)

`its-zain-dev/ps5-emutrack`: agregador de compatibilidad de emuladores de PS5 con informe SEO. Es un rastreador, no una ruta ni un componente de GTA VI en PC.

## Pendientes de decisión del propietario (6, sin cambios en este PR)

| Candidato | Señales | Tipo propuesto |
|---|---|---|
| `pragyaangaur/VIctory-macOS` | Rust, 100 commits, ~30 contribuidores, CI. Adaptación de VIctory a macOS | `component` relacionado con VIctory |
| `danekbiglike/leonida-rtx3090-bringup` | 22 commits, 24 parches sobre Leonida, GPL-3.0 | `component` o `research` |
| `kry-vex-gta/XBOX-Inspector` | Rust, ~12 MB (casi todo fuentes tipográficas), 1 commit | `tool` |
| `nvdw1/gta6-first-frame-on-pc` | 7 commits, registros y notas de reproducción con XCL | `research` |
| `Naz1r/lucy-nazir-gta6-research` | 14 commits, solo documentación | `research` |
| `AugustusNobilis/ProjectVI` | C#/C++, 1 commit, herramienta de inspección PE | `tool` |

Ninguno es elegible para la clasificación: solo `full_route` lo es.

## Proyectos principales que la búsqueda no había encontrado

Una búsqueda manual en la API muestra que las consultas originales no encontraban las rutas completas más citadas. Este PR añade consultas para que entren en el Radar por el cauce normal:

- `Marvisak/VIctory`: "An attempt at running GTA VI on PC", ~9.000 estrellas, creado el 23-11-2026.
- Continuaciones de Leonida: `ubiquitarianism/leonida` (~1.270 estrellas) y `ProjectLeonidaL/leonida` (~250 estrellas). Hay además muchas resubidas con el mismo nombre.
- `luizwidmer/palmetto`: runtime clean-room, ~120 estrellas.
- XCL: solo aparece citado por terceros; falta localizar su repositorio de origen.

## Cuestión para el propietario antes de admitir rutas completas

Varios trackers describen estas rutas como ejecución de una **compilación filtrada** de la versión de Xbox Series. Parte de los repositorios originales parece retirada; hay "continuaciones" y archivos de rescate. El documento maestro no fija una política para este caso. Hay que decidir si VI Race enlaza estos proyectos, cómo se identifica la versión objetivo sin enlazar material del juego y qué ocurre con un proyecto retirado por una reclamación. Esta decisión no la toma Claude.

**Resuelto por el propietario el 24-11-2026: rastrear sin enlazar.** Ver "Política de enlaces" en `docs/sources.md`.
