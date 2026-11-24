import {
  AssessmentSchema,
  EvidenceSchema,
  RubricSchema,
  type Assessment,
  type Evidence,
  type Project,
  type Rubric,
  type Score,
  type SourceView,
} from "@vi/contracts";
export function validateRubric(input: unknown): Rubric {
  const rubric = RubricSchema.parse(input),
    ids = new Set(rubric.milestones.map((m) => m.id));
  if (
    ids.size !== 20 ||
    rubric.milestones.reduce((s, m) => s + m.weight, 0) !== 100
  )
    throw new Error("La rúbrica requiere 20 IDs únicos y 100 puntos");
  for (let i = 1; i <= 20; i++)
    if (!ids.has(`M${String(i).padStart(2, "0")}`))
      throw new Error("IDs M01–M20 obligatorios");
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("Dependencia circular");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of rubric.milestones.find((m) => m.id === id)!
      .dependencies) {
      if (!ids.has(dep)) throw new Error("Dependencia desconocida");
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
  const normativeWeights = [
    3, 4, 4, 5, 5, 4, 5, 5, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5, 6, 7,
  ];
  if (
    rubric.milestones.some(
      (m) => m.weight !== normativeWeights[Number(m.id.slice(1)) - 1],
    )
  )
    throw new Error("Los pesos de vi-pc-v1 son inmutables");
  return rubric;
}
export function validateAssessment(
  input: unknown,
  evidenceInput: Evidence[],
  project: Project,
  authorized: string[],
  rubric: Rubric,
): Assessment {
  const a = AssessmentSchema.parse(input),
    evidence = evidenceInput.map((e) => EvidenceSchema.parse(e));
  if (
    a.project_id !== project.id ||
    !rubric.milestones.some((m) => m.id === a.milestone_id)
  )
    throw new Error("Referencia de evaluación inválida");
  const support = a.evidence_ids.map((id) => {
    const e = evidence.find((e) => e.id === id);
    if (
      !e ||
      e.project_id !== a.project_id ||
      e.target_version !== a.target_version
    )
      throw new Error("Evidencia inexistente, de otro proyecto o versión");
    return e;
  });
  if (!authorized.includes(a.reviewer))
    throw new Error("Revisor no autorizado");
  if (a.state === "confirmed") {
    if (!a.criteria_met || !support.some((e) => e.level === "E2"))
      throw new Error("Confirmación sin demostración suficiente");
    const check = a.independent_check;
    const demonstrations = support.filter((e) => e.level === "E2");
    const independent = (e: Evidence) =>
      e.independent &&
      demonstrations.every(
        (d) =>
          d.author !== e.author && d.provenance_chain !== e.provenance_chain,
      );
    const hasE3 = support.some((e) => e.level === "E3" && independent(e));
    const manual =
      check &&
      authorized.includes(check.reviewer) &&
      check.reviewer !== a.reviewer &&
      demonstrations.every((d) => d.author !== check.reviewer) &&
      check.evidence_ids.every((id) =>
        support.some(
          (e) =>
            e.id === id &&
            e.evidence_type === "independent_report" &&
            e.author === check.reviewer &&
            independent(e),
        ),
      );
    if (!hasE3 && !manual)
      throw new Error("Falta comprobación independiente documentada");
  }
  return a;
}
export function latestAssessments(
  assessments: Assessment[],
  projectId: string,
  targetVersion: string,
  cutoff: string,
): Map<string, Assessment> {
  const latest = new Map<string, Assessment>();
  for (const a of [...assessments].sort(
    (a, b) =>
      a.effective_at.localeCompare(b.effective_at) ||
      a.recorded_at.localeCompare(b.recorded_at) ||
      a.id.localeCompare(b.id),
  )) {
    if (
      a.project_id === projectId &&
      a.target_version === targetVersion &&
      a.effective_at <= cutoff &&
      a.recorded_at <= cutoff
    )
      latest.set(a.milestone_id, a);
  }
  return latest;
}
export function calculateScore(
  project: Project,
  targetVersion: string,
  assessments: Assessment[],
  rubricInput: Rubric,
  cutoff: string,
): Score {
  const rubric = validateRubric(rubricInput),
    latest = latestAssessments(assessments, project.id, targetVersion, cutoff);
  const satisfied = new Map<string, boolean>();
  const eligible =
    project.ranking_eligible &&
    project.project_type === "full_route" &&
    project.review_status === "accepted";
  const check = (id: string): boolean => {
    if (satisfied.has(id)) return satisfied.get(id)!;
    const a = latest.get(id),
      m = rubric.milestones.find((m) => m.id === id)!;
    const ok =
      !!a &&
      a.rubric_id === rubric.id &&
      a.state === "confirmed" &&
      a.criteria_met &&
      !!a.reviewer &&
      /^[a-f0-9]{40}$/.test(a.review_commit) &&
      a.evidence_ids.length > 0 &&
      m.dependencies.every(check);
    satisfied.set(id, ok);
    return ok;
  };
  const contributions = rubric.milestones.map((m) => {
    const a = latest.get(m.id),
      ok = check(m.id);
    return {
      id: m.id,
      points: eligible && ok ? m.weight : 0,
      state: a?.state ?? "unassessed",
      reason: !eligible
        ? "Fuera de la clasificación común"
        : !a
          ? "Sin confirmación suficiente"
          : a.state !== "confirmed"
            ? a.rationale
            : !ok
              ? "Dependencias suspendidas o revisión incompleta"
              : a.rationale,
      assessment_id: a?.id ?? null,
    };
  });
  return {
    score: contributions.reduce((s, m) => s + m.points, 0),
    confirmed_count: contributions.filter((m) => m.points > 0).length,
    assessed_count: latest.size,
    contributions,
  };
}
export function freshness(
  last: string | null,
  minutes: number,
  now: number,
): "updated" | "delayed" | "stale" | "unknown" {
  if (!last) return "unknown";
  const age = Math.max(0, now - Date.parse(last));
  return age < minutes * 3 * 60000
    ? "updated"
    : age < minutes * 6 * 60000
      ? "delayed"
      : "stale";
}
export function globalHealth(
  sources: SourceView[],
  now: number,
): "healthy" | "degraded" | "stale" | "unknown" {
  const primary = sources.filter((s) => s.enabled && s.priority === "primary");
  if (!primary.length) return "unknown";
  const values = primary.map((s) =>
    freshness(s.last_success_at, s.interval_minutes, now),
  );
  if (values.every((s) => s === "stale")) return "stale";
  if (values.every((s) => s === "unknown")) return "unknown";
  return values.every((s) => s === "updated") ? "healthy" : "degraded";
}
export function rankProjects<T extends Project & { score: Score }>(
  projects: T[],
): (T & { rank: number | null })[] {
  const sorted = [...projects].sort(
    (a, b) =>
      b.score.score - a.score.score || a.name.localeCompare(b.name, "es"),
  );
  let previous = -1,
    rank = 0,
    position = 0;
  return sorted.map((p) => {
    if (
      p.ranking_eligible &&
      p.project_type === "full_route" &&
      p.review_status === "accepted"
    ) {
      position++;
      if (p.score.score !== previous) rank = position;
      previous = p.score.score;
      return { ...p, rank };
    }
    return { ...p, rank: null };
  });
}
