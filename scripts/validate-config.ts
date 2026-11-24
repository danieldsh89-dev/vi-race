import { loadConfig } from "./config";
const c = loadConfig();
console.log(
  `Configuración válida: ${c.rubric.milestones.length} hitos, ${c.rubric.milestones.reduce((s, m) => s + m.weight, 0)} puntos; ${c.projects.length} proyectos admitidos. IA apagada.`,
);
