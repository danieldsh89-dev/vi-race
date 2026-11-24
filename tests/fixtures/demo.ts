import type {
  Assessment,
  Evidence,
  Project,
  ProjectView,
  Publication,
  Rubric,
  ScorePoint,
} from "@vi/contracts";
import { calculateScore, rankProjects } from "@vi/domain";
const date = "2026-11-24T12:00:00.000Z";
export const fixtureCommit = "1111111111111111111111111111111111111111";
export function fixtureProject(
  id = "project_fixture_atlas",
  name = "Atlas Runtime",
  type: Project["project_type"] = "full_route",
): Project {
  return {
    id,
    synthetic: true,
    slug: id,
    name,
    description:
      "Proyecto ficticio para explorar cómo VI Race separa declaraciones, pruebas y capacidades confirmadas. No es una iniciativa real.",
    project_type: type,
    category: type === "component" ? "Renderizado" : "Compatibilidad",
    review_status: "accepted",
    maintenance_status: "active",
    ranking_eligible: type === "full_route",
    official_url: "https://example.com/vi-race-demo",
    created_at: date,
    updated_at: date,
  };
}
export function fixtureEvidence(
  project_id = "project_fixture_atlas",
): Evidence[] {
  return ["E2", "E3"].map((level, i) => ({
    synthetic: true,
    id: `evidence_fixture_${project_id}_${level}`,
    project_id,
    source_id: `source_fixture_${project_id}`,
    url: "https://example.com/vi-race-demo",
    permalink: null,
    evidence_type: i ? "independent_report" : "document",
    level: level as Evidence["level"],
    summary:
      "Evidencia sintética para validar el recorrido. No acredita ningún avance real.",
    content_hash: "a".repeat(64),
    target_version: "fixture-v1",
    source_published_at: date,
    observed_at: date,
    availability: "available",
    provenance_chain: `fixture_chain_${i}`,
    author: `Autor sintético ${i}`,
    scope: "Material ficticio de demostración",
    limitations: ["Datos inventados para pruebas de interfaz"],
    retention_notes: "Fixture propio, sin contenido ajeno",
    independent: i === 1,
  }));
}
export function fixtureAssessment(
  milestone_id: string,
  project_id = "project_fixture_atlas",
): Assessment {
  return {
    id: `assessment_fixture_${project_id}_${milestone_id}`,
    synthetic: true,
    project_id,
    rubric_id: "vi-pc-v1",
    milestone_id,
    state: "confirmed",
    confidence: "alta",
    target_version: "fixture-v1",
    rationale:
      "Confirmación sintética; solo sirve para probar la metodología y la interfaz.",
    reviewer: "reviewer_fixture",
    review_commit: fixtureCommit,
    effective_at: date,
    recorded_at: date,
    supersedes_id: null,
    evidence_ids: fixtureEvidence(project_id).map((e) => e.id),
    criteria_met: true,
    independent_check: null,
  };
}
export function demoPublication(rubric: Rubric): Publication {
  const projects = [
    fixtureProject(),
    fixtureProject("project_fixture_meridian", "Meridian Bridge"),
    fixtureProject("project_fixture_prism", "Prism Trace", "component"),
  ];
  const views: ProjectView[] = projects.map((p, i) => {
    const assessments = ["M01", "M02", "M03"]
      .slice(0, i === 0 ? 3 : 2)
      .map((m) => fixtureAssessment(m, p.id));
    const score = calculateScore(p, "fixture-v1", assessments, rubric, date);
    const history: ScorePoint[] = [
      {
        project_id: p.id,
        rubric_id: rubric.id,
        score: score.score,
        confirmed_count: score.confirmed_count,
        effective_at: date,
        recorded_at: date,
        cause_assessment_id: assessments.at(-1)!.id,
        input_hash: "a".repeat(64),
        rules_commit: fixtureCommit,
      },
    ];
    return {
      ...p,
      score,
      assessments,
      evidence: fixtureEvidence(p.id),
      relations: [],
      history,
      last_checked_at: date,
      activity_7d: 8 - i * 2,
      activity_30d: 24 - i * 3,
      last_confirmed_at: date,
      rank: null,
      progress: {
        ladder: "vi-avance-v1" as const,
        level: [5, 3, 1][i],
        steps: (["P1", "P2", "P3", "P4", "P5"] as const)
          .slice(0, [5, 3, 1][i])
          .map((step) => ({
            step,
            source_type: "readme" as const,
            excerpt:
              "Avance ficticio de demostración; no describe ningún proyecto real.",
            ref: null,
            detected_at: date,
          })),
        updated_at: date,
      },
      stats: {
        stars: [1200, 340, 45][i],
        forks: [80, 20, 3][i],
        language: "Rust",
        pushed_at: date,
        created_at: "2026-11-20T00:00:00Z",
        last_commit_at: date,
        last_commit_message: "Cambio ficticio de demostración",
      },
      activity_daily: Array.from({ length: 14 }, (_, d) => (d * (3 - i)) % 9),
    };
  });
  return {
    schema_version: "1",
    synthetic: true,
    publication_id: "pub_fixture_demo",
    generated_at: date,
    last_collection_success_at: date,
    mode: "demo",
    data: {
      projects: rankProjects(views),
      candidates: [
        {
          id: "candidate_fixture_aurora",
          provider_repo_id: "fixture_999",
          canonical_url: "https://example.com/vi-race-demo",
          name: "Aurora Lab · ejemplo ficticio",
          description:
            "Candidato sintético. Descubrirlo no equivale a aprobarlo.",
          query_id: "query_fixture",
          first_seen_at: date,
          last_seen_at: date,
          status: "pending_review",
          reason: "Relevancia pendiente de revisión humana",
          linked_project_id: null,
          review_commit: null,
        },
      ],
      sources: projects.map((p) => ({
        id: `source_fixture_${p.id}`,
        project_id: p.id,
        adapter: "github",
        repository: "example/fixture",
        provider_repo_id: null,
        enabled: true,
        priority: "primary",
        interval_minutes: 10,
        canonical_url: "https://example.com/vi-race-demo",
        terms_url: "https://docs.github.com/en/site-policy",
        access_notes: "Fuente sintética; no se realizan peticiones.",
        last_checked_at: date,
        last_success_at: date,
        failure_count: 0,
        last_error_code: null,
      })),
      rubric,
      events: [],
      runs: [],
      discovery_last_success_at: date,
      health: "unknown",
    },
    warnings: [
      "DEMOSTRACIÓN: todos los proyectos, pruebas y puntos de esta vista son ficticios.",
    ],
  };
}
