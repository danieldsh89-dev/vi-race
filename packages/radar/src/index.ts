import type {
  Candidate,
  CandidateReview,
  CandidateSignal,
} from "@vi/contracts";
/** Un mismo nombre o descripción publicado por al menos este número de cuentas. */
export const REPEAT_THRESHOLD = 3;
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
/**
 * Señales deterministas de duplicación (documento maestro: filtrado determinista).
 * Solo orientan la revisión: no rechazan, no admiten y no cambian el estado.
 */
export function duplicationSignals(candidates: Candidate[]): Candidate[] {
  const repoName = (c: Candidate) =>
    normalize(c.name.split("/")[1] ?? c.name).replace(/-\d{4}$/, "");
  const owners = (key: (c: Candidate) => string) => {
    const map = new Map<string, Set<string>>();
    for (const c of candidates) {
      const k = key(c);
      if (!k) continue;
      const owner = normalize(c.name.split("/")[0] ?? "");
      map.set(k, (map.get(k) ?? new Set()).add(owner));
    }
    return map;
  };
  const byName = owners(repoName),
    byDescription = owners((c) => normalize(c.description));
  return candidates.map((c) => {
    const signals: CandidateSignal[] = [];
    if ((byName.get(repoName(c))?.size ?? 0) >= REPEAT_THRESHOLD)
      signals.push("repeated_name");
    const d = normalize(c.description);
    if (d && (byDescription.get(d)?.size ?? 0) >= REPEAT_THRESHOLD)
      signals.push("repeated_description");
    if (/\/\.github$/i.test(c.name)) signals.push("profile_repository");
    const { signals: _old, ...rest } = c;
    return signals.length ? { ...rest, signals } : rest;
  });
}
export function mergeCandidates(
  existing: Candidate[],
  incoming: Candidate[],
): Candidate[] {
  const result = new Map(existing.map((c) => [c.provider_repo_id, c]));
  for (const c of incoming) {
    const old = result.get(c.provider_repo_id);
    result.set(
      c.provider_repo_id,
      old
        ? {
            ...old,
            canonical_url: c.canonical_url,
            name: c.name,
            description: c.description,
            last_seen_at: c.last_seen_at,
          }
        : c,
    );
  }
  return [...result.values()].sort(
    (a, b) =>
      b.first_seen_at.localeCompare(a.first_seen_at) ||
      a.id.localeCompare(b.id),
  );
}
export function applyCandidateReview(
  candidate: Candidate,
  review: CandidateReview,
  authorized: string[],
): Candidate {
  if (
    review.candidate_id !== candidate.id ||
    !authorized.includes(review.reviewer)
  )
    throw new Error("Revisión de candidato no autorizada");
  if (
    ["accepted", "duplicate"].includes(review.status) &&
    !review.linked_project_id
  )
    throw new Error("Falta identidad de destino");
  return {
    ...candidate,
    status: review.status,
    reason: review.reason,
    linked_project_id: review.linked_project_id,
    review_commit: review.review_commit,
  };
}
