import type { Repository, Relation } from "@vi/contracts";
export function declaredFork(
  repository: Repository,
  repositories: Repository[],
): Relation | null {
  const parent = repositories.find(
    (r) => r.provider_repo_id === repository.parent_id,
  );
  if (
    !parent?.project_id ||
    !repository.project_id ||
    parent.project_id === repository.project_id
  )
    return null;
  return {
    id: `fork_${repository.provider_repo_id}_${parent.provider_repo_id}`,
    from_project_id: repository.project_id,
    to_project_id: parent.project_id,
    relation_type: "fork_of",
    confidence: "alta",
    state: "proposed",
    rationale:
      "Parentesco declarado por la API de GitHub; no implica herencia de puntos.",
    evidence_ids: [],
  };
}
export function validateRelations(relations: Relation[]): void {
  if (relations.some((r) => r.from_project_id === r.to_project_id))
    throw new Error("Relación consigo mismo");
  const visit = (id: string, path: Set<string>) => {
    if (path.has(id)) throw new Error("Ciclo de sucesión");
    const next = new Set(path).add(id);
    for (const r of relations.filter(
      (r) => r.from_project_id === id && r.relation_type === "successor_of",
    ))
      visit(r.to_project_id, next);
  };
  for (const r of relations) visit(r.from_project_id, new Set());
}
