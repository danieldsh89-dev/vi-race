import { z } from "zod";
export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const utc = z.iso.datetime();
export const safeUrl = z
  .url()
  .refine((s) => new URL(s).protocol === "https:", "Se requiere HTTPS");
export const states = [
  "unassessed",
  "claimed",
  "in_review",
  "confirmed",
  "disputed",
  "refuted",
  "regressed",
  "not_applicable",
] as const;
export const projectTypes = [
  "full_route",
  "component",
  "tool",
  "research",
  "official",
  "candidate",
] as const;
export const ProjectSchema = z
  .object({
    id,
    slug: id,
    name: z.string().min(1).max(160),
    description: z.string().max(2000),
    project_type: z.enum(projectTypes),
    category: z.string().max(100),
    review_status: z.enum(["pending_review", "accepted", "rejected"]),
    maintenance_status: z.enum(["active", "archived", "unknown", "inactive"]),
    ranking_eligible: z.boolean(),
    official_url: safeUrl.nullable(),
    /**
     * Política de enlaces. Sin valor equivale a "text_only": el proyecto se
     * rastrea y sus URL se muestran como texto, sin hipervínculos. "link" exige
     * que una revisión haya comprobado que no depende de material filtrado.
     */
    link_policy: z.enum(["link", "text_only"]).optional(),
    created_at: utc,
    updated_at: utc,
    synthetic: z.boolean().optional(),
  })
  .strict();
export type Project = z.infer<typeof ProjectSchema>;
export const MilestoneSchema = z
  .object({
    id: z.string().regex(/^M\d{2}$/),
    name: z.string(),
    weight: z.number().int().positive(),
    criteria: z.string().min(20),
    dependencies: z.array(z.string()),
  })
  .strict();
export const RubricSchema = z
  .object({
    id: z.literal("vi-pc-v1"),
    version: z.literal("1"),
    milestones: z.array(MilestoneSchema).length(20),
  })
  .strict();
export type Rubric = z.infer<typeof RubricSchema>;
export const EvidenceSchema = z
  .object({
    synthetic: z.boolean().optional(),
    id,
    project_id: id,
    source_id: id,
    url: safeUrl,
    permalink: safeUrl.nullable(),
    evidence_type: z.enum([
      "document",
      "code",
      "log",
      "video",
      "independent_report",
    ]),
    level: z.enum(["E0", "E1", "E2", "E3"]),
    summary: z.string().min(1).max(4000),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    target_version: z.string().min(1),
    source_published_at: utc.nullable(),
    observed_at: utc,
    availability: z.enum(["available", "withdrawn", "unavailable"]),
    provenance_chain: z.string().min(1),
    author: z.string().min(1),
    scope: z.string().min(1),
    limitations: z.array(z.string()),
    retention_notes: z.string().min(1),
    independent: z.boolean(),
  })
  .strict();
export type Evidence = z.infer<typeof EvidenceSchema>;
export const AssessmentSchema = z
  .object({
    synthetic: z.boolean().optional(),
    id,
    project_id: id,
    rubric_id: z.literal("vi-pc-v1"),
    milestone_id: z.string().regex(/^M\d{2}$/),
    state: z.enum(states),
    confidence: z.enum(["baja", "media", "alta"]),
    target_version: z.string().min(1),
    rationale: z.string().min(10),
    reviewer: z.string().min(1),
    review_commit: z.string().regex(/^[a-f0-9]{40}$/),
    effective_at: utc,
    recorded_at: utc,
    supersedes_id: id.nullable(),
    evidence_ids: z.array(id),
    criteria_met: z.boolean(),
    independent_check: z
      .object({
        reviewer: z.string().min(1),
        method: z.string().min(20),
        evidence_ids: z.array(id).min(1),
      })
      .nullable(),
  })
  .strict();
export type Assessment = z.infer<typeof AssessmentSchema>;
export const SourceSchema = z
  .object({
    id,
    project_id: id.nullable(),
    adapter: z.literal("github"),
    repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    provider_repo_id: z.string().nullable(),
    enabled: z.boolean(),
    priority: z.enum(["primary", "secondary"]),
    interval_minutes: z.number().int().min(5),
    canonical_url: safeUrl,
    terms_url: safeUrl,
    access_notes: z.string(),
  })
  .strict();
export type Source = z.infer<typeof SourceSchema>;
export interface SourceState {
  source_id: string;
  cursor: { since: string | null; head_sha: string | null };
  etag: string | null;
  last_modified: string | null;
  next_due_at: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  failure_count: number;
  last_error_code: string | null;
}
export interface Observation {
  id: string;
  source_id: string;
  project_id: string | null;
  external_id: string;
  event_type: string;
  source_published_at: string | null;
  observed_at: string;
  content_hash: string;
  payload: Record<string, unknown>;
}
export interface Repository {
  id: string;
  project_id: string | null;
  provider_repo_id: string;
  owner: string;
  name: string;
  canonical_url: string;
  default_branch: string;
  head_sha: string | null;
  archived: boolean;
  parent_id: string | null;
}
export interface Candidate {
  id: string;
  provider_repo_id: string;
  canonical_url: string;
  name: string;
  description: string;
  query_id: string;
  first_seen_at: string;
  last_seen_at: string;
  status: "pending_review" | "accepted" | "rejected" | "duplicate" | "deferred";
  reason: string;
  linked_project_id: string | null;
  review_commit: string | null;
  /** Señales deterministas calculadas al publicar; orientan la revisión, nunca deciden. */
  signals?: CandidateSignal[];
}
export const candidateSignals = [
  "repeated_name",
  "repeated_description",
  "profile_repository",
] as const;
export type CandidateSignal = (typeof candidateSignals)[number];
export interface Relation {
  id: string;
  from_project_id: string;
  to_project_id: string;
  relation_type:
    | "fork_of"
    | "renamed_from"
    | "successor_of"
    | "component_of"
    | "shares_code_with"
    | "possible_duplicate";
  confidence: "baja" | "media" | "alta";
  state: "proposed" | "reviewed";
  rationale: string;
  evidence_ids: string[];
}
export interface Score {
  score: number;
  confirmed_count: number;
  assessed_count: number;
  contributions: {
    id: string;
    points: number;
    state: (typeof states)[number];
    reason: string;
    assessment_id: string | null;
  }[];
}
export interface ScorePoint {
  project_id: string;
  rubric_id: string;
  score: number;
  confirmed_count: number;
  effective_at: string;
  recorded_at: string;
  cause_assessment_id: string | null;
  input_hash: string;
  rules_commit: string;
}
export interface ProjectView extends Project {
  score: Score;
  assessments: Assessment[];
  evidence: Evidence[];
  relations: Relation[];
  history: ScorePoint[];
  last_checked_at: string | null;
  activity_7d: number;
  activity_30d: number;
  last_confirmed_at: string | null;
  rank: number | null;
}
export interface SourceView extends Source {
  last_checked_at: string | null;
  last_success_at: string | null;
  failure_count: number;
  last_error_code: string | null;
}
export interface Run {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  code_commit: string;
  metrics: Record<string, number>;
  error_summary: string | null;
}
export interface Publication {
  schema_version: "1";
  synthetic?: boolean;
  publication_id: string;
  generated_at: string;
  last_collection_success_at: string | null;
  mode: "normal" | "demo" | "static";
  data: {
    projects: ProjectView[];
    candidates: Candidate[];
    sources: SourceView[];
    rubric: Rubric;
    events: Observation[];
    runs: Run[];
    discovery_last_success_at: string | null;
    health: "healthy" | "degraded" | "stale" | "unknown";
  };
  warnings: string[];
}
export const CandidateReviewSchema = z
  .object({
    id,
    candidate_id: id,
    status: z.enum(["accepted", "rejected", "duplicate", "deferred"]),
    reason: z.string().min(10),
    reviewer: z.string().min(1),
    review_commit: z.string().regex(/^[a-f0-9]{40}$/),
    occurred_at: utc,
    linked_project_id: id.nullable(),
  })
  .strict();
export type CandidateReview = z.infer<typeof CandidateReviewSchema>;
export const BudgetsSchema = z
  .object({
    max_projects: z.number().int().max(20).positive(),
    requests_per_cycle: z.number().int().max(100).positive(),
    max_payload_bytes: z.number().int().max(2000000).positive(),
    max_candidates: z.number().int().max(50).positive(),
    max_job_seconds: z.number().int().max(480).positive(),
    github_reserve_fraction: z.number().min(0.2).max(1),
    main_publication_bytes: z.number().int().max(256000).positive(),
    detail_bytes: z.number().int().max(102400).positive(),
  })
  .strict();
export type Budgets = z.infer<typeof BudgetsSchema>;
export const FeaturesSchema = z
  .object({
    schema_version: z.literal("1"),
    ai_enabled: z.literal(false),
    github_enabled: z.boolean(),
    feeds_enabled: z.literal(false),
    paid_fallback: z.literal(false),
  })
  .strict();
export const DiscoverySchema = z
  .object({
    enabled: z.boolean(),
    interval_minutes: z.number().int().min(15),
    max_pages: z.number().int().min(1).max(3),
    queries: z
      .array(z.object({ id, query: z.string().min(1).max(256) }))
      .max(10),
  })
  .strict();
