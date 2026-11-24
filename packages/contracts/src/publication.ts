import { z } from "zod";
import {
  id,
  utc,
  safeUrl,
  states,
  ProjectSchema,
  AssessmentSchema,
  EvidenceSchema,
  SourceSchema,
  RubricSchema,
  candidateSignals,
} from "./index";
const ScoreSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    confirmed_count: z.number().int().min(0).max(20),
    assessed_count: z.number().int().min(0).max(20),
    contributions: z
      .array(
        z
          .object({
            id: z.string().regex(/^M\d{2}$/),
            points: z.number().int().min(0).max(7),
            state: z.enum(states),
            reason: z.string().max(4000),
            assessment_id: id.nullable(),
          })
          .strict(),
      )
      .length(20),
  })
  .strict();
export const ScorePointSchema = z
  .object({
    project_id: id,
    rubric_id: z.literal("vi-pc-v1"),
    score: z.number().int().min(0).max(100),
    confirmed_count: z.number().int().min(0).max(20),
    effective_at: utc,
    recorded_at: utc,
    cause_assessment_id: id.nullable(),
    input_hash: z.string().regex(/^[a-f0-9]{64}$/),
    rules_commit: z.string().regex(/^[a-f0-9]{40}$/),
  })
  .strict();
const RelationSchema = z
  .object({
    id,
    from_project_id: id,
    to_project_id: id,
    relation_type: z.enum([
      "fork_of",
      "renamed_from",
      "successor_of",
      "component_of",
      "shares_code_with",
      "possible_duplicate",
    ]),
    confidence: z.enum(["baja", "media", "alta"]),
    state: z.enum(["proposed", "reviewed"]),
    rationale: z.string().max(4000),
    evidence_ids: z.array(id),
  })
  .strict();
export const CandidateSchema = z
  .object({
    id,
    provider_repo_id: z.string().max(100),
    canonical_url: safeUrl,
    name: z.string().max(300),
    description: z.string().max(2000),
    query_id: id,
    first_seen_at: utc,
    last_seen_at: utc,
    status: z.enum([
      "pending_review",
      "accepted",
      "rejected",
      "duplicate",
      "deferred",
    ]),
    reason: z.string().max(4000),
    linked_project_id: id.nullable(),
    review_commit: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .nullable(),
    signals: z.array(z.enum(candidateSignals)).max(3).optional(),
    repo: z
      .object({
        stars: z.number().int().nonnegative(),
        size_kb: z.number().int().nonnegative(),
        language: z.string().max(100).nullable(),
        fork: z.boolean(),
        pushed_at: z.string().max(40).nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const PublicationSchema = z
  .object({
    schema_version: z.literal("1"),
    synthetic: z.boolean().optional(),
    publication_id: z.string().regex(/^pub_[\w-]{1,100}$/),
    generated_at: utc,
    last_collection_success_at: utc.nullable(),
    mode: z.enum(["normal", "demo", "static"]),
    data: z
      .object({
        projects: z
          .array(
            ProjectSchema.extend({
              score: ScoreSchema,
              assessments: z.array(AssessmentSchema),
              evidence: z.array(EvidenceSchema),
              relations: z.array(RelationSchema),
              history: z.array(ScorePointSchema),
              last_checked_at: utc.nullable(),
              activity_7d: z.number().int().nonnegative(),
              activity_30d: z.number().int().nonnegative(),
              last_confirmed_at: utc.nullable(),
              rank: z.number().int().positive().nullable(),
              progress: z
                .object({
                  ladder: z.literal("vi-avance-v1"),
                  level: z.number().int().min(0).max(8),
                  steps: z
                    .array(
                      z
                        .object({
                          step: z.enum([
                            "P1",
                            "P2",
                            "P3",
                            "P4",
                            "P5",
                            "P6",
                            "P7",
                            "P8",
                          ]),
                          source_type: z.enum(["readme", "release", "commit"]),
                          excerpt: z.string().max(300),
                          ref: z.string().max(500).nullable(),
                          detected_at: utc,
                          baseline: z.boolean().optional(),
                        })
                        .strict(),
                    )
                    .max(8),
                  updated_at: utc.nullable(),
                })
                .strict(),
              stats: z
                .object({
                  stars: z.number().int().nonnegative(),
                  forks: z.number().int().nonnegative(),
                  language: z.string().max(100).nullable(),
                  pushed_at: z.string().max(40).nullable(),
                  created_at: z.string().max(40).nullable(),
                  last_commit_at: z.string().max(40).nullable(),
                  last_commit_message: z.string().max(300).nullable(),
                })
                .strict()
                .nullable(),
              activity_daily: z.array(z.number().int().nonnegative()).max(31),
            }).strict(),
          )
          .max(60),
        candidates: z.array(CandidateSchema).max(1000),
        sources: z
          .array(
            SourceSchema.extend({
              last_checked_at: utc.nullable(),
              last_success_at: utc.nullable(),
              failure_count: z.number().int().nonnegative(),
              last_error_code: z.string().max(200).nullable(),
            }).strict(),
          )
          .max(100),
        rubric: RubricSchema,
        events: z
          .array(
            z
              .object({
                id,
                source_id: id,
                project_id: id.nullable(),
                external_id: z.string().max(300),
                event_type: z.string().max(100),
                source_published_at: utc.nullable(),
                observed_at: utc,
                content_hash: z.string().regex(/^[a-f0-9]{64}$/),
                payload: z.record(z.string(), z.unknown()),
              })
              .strict(),
          )
          .max(30),
        runs: z
          .array(
            z
              .object({
                id,
                started_at: utc,
                finished_at: utc.nullable(),
                status: z.enum(["running", "success", "partial", "failed"]),
                code_commit: z.string().regex(/^[a-f0-9]{40}$/),
                metrics: z.record(z.string(), z.number()),
                error_summary: z.string().max(4000).nullable(),
              })
              .strict(),
          )
          .max(10),
        discovery_last_success_at: utc.nullable(),
        health: z.enum(["healthy", "degraded", "stale", "unknown"]),
      })
      .strict(),
    warnings: z.array(z.string().max(4000)).max(20),
  })
  .strict();
