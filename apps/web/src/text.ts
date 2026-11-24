export const labels = {
  types: {
    full_route: "Ruta completa",
    component: "Componente",
    tool: "Herramienta",
    research: "Investigación",
    official: "Información oficial",
    candidate: "Candidato",
  },
  states: {
    unassessed: "Sin evaluar",
    claimed: "Declarado",
    in_review: "En revisión",
    confirmed: "Confirmado",
    disputed: "Discutido",
    refuted: "Refutado",
    regressed: "Regresión",
    not_applicable: "No aplicable",
  },
  health: {
    healthy: "Fuentes al día",
    degraded: "Seguimiento parcial",
    stale: "Datos sin actualizar",
    unknown: "Sin comprobaciones",
  },
  freshness: {
    updated: "Actualizada",
    delayed: "Retrasada",
    stale: "Sin actualizar",
    unknown: "Sin comprobar",
  },
  maintenance: {
    active: "Activo",
    archived: "Archivado",
    inactive: "Sin actividad reciente",
    unknown: "Mantenimiento desconocido",
  },
};
export function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Sin registro";
}
