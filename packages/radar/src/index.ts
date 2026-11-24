import type { Candidate, CandidateReview } from "@vi/contracts";
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
