import { readFileSync, readdirSync } from "node:fs";
import { z } from "zod";
import {
  BudgetsSchema,
  DiscoverySchema,
  FeaturesSchema,
  ProjectSchema,
  SourceSchema,
  AssessmentSchema,
  EvidenceSchema,
  CandidateReviewSchema,
} from "@vi/contracts";
import { validateRubric, validateAssessment } from "@vi/domain";
export const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
export function assertProductionInputs(c: {
  projects: { id: string; synthetic?: boolean }[];
  evidence: { id: string; synthetic?: boolean }[];
  assessments: { id: string; synthetic?: boolean }[];
}) {
  for (const entry of [...c.projects, ...c.evidence, ...c.assessments])
    if (
      entry.synthetic ||
      /^(?:project|evidence|assessment)_fixture_/.test(entry.id)
    )
      throw new Error("Entidad sintética rechazada antes de persistir");
}
export function loadConfig() {
  const projects = z
    .object({
      schema_version: z.literal("1"),
      projects: z.array(ProjectSchema),
      target_versions: z.record(z.string(), z.string().min(1)),
    })
    .strict()
    .parse(readJson("config/projects.json"));
  const sources = z
    .object({ schema_version: z.literal("1"), sources: z.array(SourceSchema) })
    .strict()
    .parse(readJson("config/sources.json")).sources;
  const reviewerPolicy = z
    .object({
      schema_version: z.literal("1"),
      authorized_reviewers: z.array(z.string()),
      historical_reviewers: z
        .array(
          z.object({
            reviewer: z.string(),
            from: z.iso.datetime(),
            until: z.iso.datetime(),
          }),
        )
        .default([]),
    })
    .strict()
    .parse(readJson("config/reviewers.json"));
  const reviewers = reviewerPolicy.authorized_reviewers;
  const reviewersAt = (date: string) => [
    ...reviewers,
    ...reviewerPolicy.historical_reviewers
      .filter((r) => r.from <= date && r.until >= date)
      .map((r) => r.reviewer),
  ];
  const rubric = validateRubric(readJson("config/rubrics/vi-pc-v1.json"));
  const budgets = BudgetsSchema.parse(readJson("config/budgets.json")),
    features = FeaturesSchema.parse(readJson("config/features.json")),
    discovery = DiscoverySchema.parse(readJson("config/discovery.json"));
  if (projects.projects.length > budgets.max_projects)
    throw new Error("Presupuesto de proyectos superado");
  for (const values of [projects.projects, sources])
    if (new Set(values.map((x) => x.id)).size !== values.length)
      throw new Error("ID duplicado");
  if (
    new Set(projects.projects.map((p) => p.slug)).size !==
    projects.projects.length
  )
    throw new Error("Slug duplicado");
  for (const p of projects.projects) {
    if (p.synthetic || p.id.startsWith("project_fixture_"))
      throw new Error("Proyecto sintético en configuración real");
    if (p.review_status !== "accepted" || !projects.target_versions[p.id])
      throw new Error("Proyecto sin aceptación o versión");
    if (p.ranking_eligible && p.project_type !== "full_route")
      throw new Error("Componente no elegible");
  }
  for (const s of sources) {
    if (s.project_id && !projects.projects.some((p) => p.id === s.project_id))
      throw new Error("Fuente huérfana");
    if (s.enabled && !s.provider_repo_id)
      throw new Error("Las fuentes admitidas necesitan ID estable de GitHub");
  }
  const documents = readdirSync("reviews")
    .filter((n) => n.endsWith(".json"))
    .map((n) => readJson(`reviews/${n}`));
  const reviewSchema = z
    .object({
      schema_version: z.literal("1"),
      evidence: z.array(EvidenceSchema),
      assessments: z.array(AssessmentSchema),
      candidate_reviews: z.array(CandidateReviewSchema),
    })
    .strict();
  const reviews = documents.map((d) => reviewSchema.parse(d));
  const evidence = reviews.flatMap((r) => r.evidence),
    assessments = reviews.flatMap((r) => r.assessments),
    candidateReviews = reviews.flatMap((r) => r.candidate_reviews);
  assertProductionInputs({
    projects: projects.projects,
    evidence,
    assessments,
  });
  for (const e of evidence)
    if (
      !sources.some(
        (s) => s.id === e.source_id && s.project_id === e.project_id,
      )
    )
      throw new Error("Evidencia sin fuente admitida");
  for (const a of assessments) {
    const p = projects.projects.find((p) => p.id === a.project_id);
    if (!p) throw new Error("Proyecto de evaluación inexistente");
    validateAssessment(a, evidence, p, reviewersAt(a.recorded_at), rubric);
    if (
      a.supersedes_id &&
      !assessments.some(
        (old) =>
          old.id === a.supersedes_id &&
          old.project_id === a.project_id &&
          old.milestone_id === a.milestone_id &&
          old.effective_at <= a.effective_at,
      )
    )
      throw new Error("Rectificación inválida");
  }
  if (
    new Set(evidence.map((e) => e.id)).size !== evidence.length ||
    new Set(assessments.map((a) => a.id)).size !== assessments.length
  )
    throw new Error("ID de revisión duplicado");
  return {
    projects: projects.projects,
    target_versions: projects.target_versions,
    sources,
    reviewers,
    reviewersAt,
    rubric,
    budgets,
    features,
    discovery,
    evidence,
    assessments,
    candidateReviews,
  };
}
export type Config = ReturnType<typeof loadConfig>;
