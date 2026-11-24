import { it, expect } from "vitest";
import {
  detect,
  emptyProgress,
  level,
  mergeProgress,
  relevantLines,
} from "@vi/progress";
const at = "2026-11-24T12:00:00.000Z";
const steps = (text: string, source_type: "readme" | "commit" | "release") =>
  detect({ source_type, text, ref: null, at }).map((s) => s.step);
it("detecta avances anunciados en un README de estado", () => {
  const readme = `# Project
![logo](logo.png)
## Status
- [x] PE loader maps the executable and resolves imports
- Boots into the game's main loop
- Renders the first frame through D3D12
- Shows the Rockstar logos and plays the intro video
## Roadmap
- Reach the title screen
- Fully playable`;
  expect(steps(readme, "readme")).toEqual(["P1", "P2", "P3", "P4"]);
});
it("ignora negaciones, planes y casillas sin marcar", () => {
  expect(steps("It does not boot yet.", "readme")).toEqual([]);
  expect(steps("- [ ] title screen", "readme")).toEqual([]);
  expect(steps("Goal: reach the main menu", "readme")).toEqual([]);
  expect(steps("Todavía no arranca", "readme")).toEqual([]);
  expect(steps("GTA VI is not playable on PC.", "readme")).toEqual([]);
});
it("una negación no anula otra frase de la misma línea", () => {
  expect(
    steps("Audio is not implemented. The title screen now renders.", "readme"),
  ).toEqual(["P5"]);
});
it("en commits exige un verbo de logro", () => {
  expect(steps("fix boot crash in loader", "commit")).toEqual([]);
  expect(steps("refactor title screen code", "commit")).toEqual([]);
  expect(steps("Now reaches the title screen!", "commit")).toEqual(["P5"]);
});
it("un logo de cabecera no es un avance", () => {
  expect(relevantLines("![VIctory logo](a.png)\n# Logo\nText")).toEqual([]);
});
it("el estado es acumulativo y conserva la detección más antigua", () => {
  const first = detect({
    source_type: "release",
    text: "v0.2: boots to the main menu",
    ref: "r1",
    at: "2026-11-24T10:00:00.000Z",
  });
  const later = detect({
    source_type: "readme",
    text: "The main menu renders.",
    ref: null,
    at: "2026-11-24T11:00:00.000Z",
  });
  const a = mergeProgress(emptyProgress(), first, at).state;
  const b = mergeProgress(a, later, at);
  expect(b.changed).toBe(false);
  expect(b.state.steps.P5?.ref).toBe("r1");
  expect(level(b.state)).toBe(5);
});
it("casos reales: capas de varios juegos exigen contexto o alias", () => {
  const table = `## Games
| Game | Status |
|---|---|
| Minecraft | ✅ fully playable |
| **A newer retail game** | 🚧 | starts in ~4 s, runs at a steady 30 fps without a crash, shows its menus; fits a 32 GB machine (~15 GB committed) gameplay not reached yet |`;
  const multi = (aliases: string[] = []) =>
    detect(
      { source_type: "readme", text: table, ref: null, at },
      { multiTitle: true, aliases },
    ).map((s) => s.step);
  expect(multi()).toEqual([]);
  expect(multi(["a newer retail game"])).toEqual(["P5"]);
});
it("casos reales: tablas de estado y rutas de archivo", () => {
  expect(
    steps(
      "| Time | What happens |\n|---|---|\n| 60–84 s | The world loads behind its loading screens. |",
      "readme",
    ),
  ).toEqual(["P6"]);
  expect(
    steps("These commands use the package in game_path.txt", "readme"),
  ).toEqual([]);
  expect(
    steps("Work on booting can start as soon as one is available.", "readme"),
  ).toEqual([]);
});
it("el selector de jugador en pantalla cuenta como primeros gráficos", () => {
  const steps = detect(
    {
      source_type: "readme",
      text: "**GTA VI (ProjectScarlett)** shows the player selection prompt at 3840×2160 on stock Proton Experimental.",
      ref: null,
      at,
    },
    { multiTitle: true },
  ).map((s) => s.step);
  expect(steps).toEqual(["P3"]);
});
it("un siguiente hito es un plan, no un avance", () => {
  expect(steps("Next milestone: the first frame.", "readme")).toEqual([]);
  expect(
    steps("Loading The executable and its DLLs load through the Windows loader;", "readme"),
  ).toEqual(["P1"]);
});
