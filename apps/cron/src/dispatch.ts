/** Último run conocido del workflow del monitor (subconjunto de la API de GitHub). */
export interface LatestRun {
  status: string;
  created_at: string;
}
/** Margen mínimo entre ciclos: el monitor ya respeta sus propios intervalos. */
export const MIN_GAP_MS = 8 * 60 * 1000;
/** Un run sin terminar puede quedarse colgado; pasado este tiempo se ignora. */
export const STALE_MS = 30 * 60 * 1000;
/**
 * Decide si hay que disparar el monitor. No lo hace si ya hay uno en cola o en
 * curso, ni si el último empezó hace menos de 8 minutos (por ejemplo, porque
 * el programador de GitHub sí funcionó).
 */
export function shouldDispatch(
  latest: LatestRun | null,
  now: number,
): { dispatch: boolean; reason: string } {
  if (!latest) return { dispatch: true, reason: "sin ejecuciones previas" };
  const age = now - Date.parse(latest.created_at);
  if (!Number.isFinite(age)) return { dispatch: true, reason: "fecha ilegible" };
  if (latest.status !== "completed" && age < STALE_MS)
    return { dispatch: false, reason: `ya hay un ciclo ${latest.status}` };
  if (age < MIN_GAP_MS)
    return { dispatch: false, reason: "el último ciclo es reciente" };
  return { dispatch: true, reason: "toca un ciclo nuevo" };
}
