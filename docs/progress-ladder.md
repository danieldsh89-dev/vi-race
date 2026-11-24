# Escalera vi-avance-v1 (vista principal)

Decisión del propietario (24-11-2026): VI Race es un panel autónomo que reúne en un solo sitio los proyectos comunitarios que intentan ejecutar en PC la build pública de Xbox Series de GTA VI, y muestra hasta dónde llega cada uno. Se actualiza solo, sin revisión manual del propietario. La curaduría de fuentes está delegada en `claude-curator`.

## Los 8 pasos

| Paso | Nombre | Qué significa |
|---|---|---|
| P1 | Carga el ejecutable | Abre y mapea el ejecutable, resuelve importaciones o llega al punto de entrada. |
| P2 | Ejecuta código del juego | Arranque, inicialización o hilos propios funcionando. |
| P3 | Primeros gráficos | Primer fotograma, superficies o shaders traducidos en uso. |
| P4 | Logos e intro | Logos, pantallas legales o vídeo de introducción. |
| P5 | Pantalla de título o menú | Se alcanza el título o el menú principal. |
| P6 | Carga el mundo | Se carga el mundo o se entra en partida. |
| P7 | Control del personaje | Se controla al personaje en el mundo. |
| P8 | Jugable | Jugable de forma sostenida. |

## Cómo se detecta

- Fuente: README, versiones y commits de cada repositorio, leídos por la API pública de GitHub cada 10 minutos (`@vi/progress`).
- Reglas deterministas por expresiones regulares, sin IA. Se descartan negaciones, planes, hojas de ruta, cabeceras de tabla, rutas de archivo y menciones de otros juegos. Los commits exigen un verbo de logro.
- Los proyectos `multi_title` solo cuentan frases con contexto de GTA o con sus alias declarados.
- El estado es acumulativo: se conserva la detección más antigua de cada paso y en cada publicación se revalida con las reglas vigentes.
- Lo que un proyecto ya anunciaba en su primera lectura se marca como **punto de partida** (`baseline`) y no aparece como novedad.

Es **lo que anuncian sus autores**, detectado automáticamente. No es una verificación independiente. La rúbrica estricta vi-pc-v1 (20 hitos, evidencia E2/E3 y revisión) sigue disponible en `/audit` y en cada ficha.

## Radar y seguimiento automático

`classify()` en `@vi/radar` decide sobre cada candidato descubierto, con un motivo legible:

- **Rechazo**: copias repetidas en varias cuentas, reclamos de descarga o instaladores (patrón de malware), repositorios prácticamente vacíos, promesas de jugar en PC sin código.
- **Fuera de alcance**: rastreadores y archivos que recopilan otros proyectos, contenido de fans (mapas, noticias, clips) y temas ajenos (mando, subtítulos, otras plataformas, multijugador).
- **Seguimiento automático**: no es fork, lenguaje de código, al menos 25 estrellas y 300 KB, texto técnico y sobre GTA VI o Xbox Series.
- **En observación**: el resto, con el motivo concreto (pocas estrellas, sin código todavía, bifurcación).

Política de enlaces: «rastrear sin enlazar». Los repositorios se muestran como texto, sin hipervínculo, salvo autorización expresa (`link_policy: "link"`).
