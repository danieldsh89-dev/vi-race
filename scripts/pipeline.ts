import { randomUUID } from "node:crypto";
import type {
  Assessment,
  Candidate,
  Evidence,
  Observation,
  ProjectView,
  Publication,
  Repository,
  Run,
  ScorePoint,
  SourceState,
  SourceView,
  Relation,
} from "@vi/contracts";
import {
  calculateScore,
  globalHealth,
  rankProjects,
  validateAssessment,
} from "@vi/domain";
import { declaredFork } from "@vi/dna";
import {
  mergeCandidates,
  applyCandidateReview,
  applyClassification,
  duplicationSignals,
} from "@vi/radar";
import {
  checksum,
  insert,
  readEntities,
  type SqlStore,
  type Statement,
} from "@vi/storage";
import { CollectionError, GitHubClient, hash } from "@vi/collectors";
import {
  detect,
  emptyProgress,
  level as progressLevel,
  mergeProgress,
  relevantLines,
  RULES_VERSION,
  revalidate,
  type ProgressSignal,
  type ProgressState,
} from "@vi/progress";
import type { Config } from "./config";
import { assertProductionInputs } from "./config";
import { PublicationSchema } from "@vi/contracts/publication";
export function initialState(id: string): SourceState {
  return {
    source_id: id,
    cursor: { since: null, head_sha: null },
    etag: null,
    last_modified: null,
    next_due_at: "1970-01-01T00:00:00Z",
    last_checked_at: null,
    last_success_at: null,
    failure_count: 0,
    last_error_code: null,
  };
}
function stateStatement(s: SourceState) {
  return insert(
    "source_state",
    {
      source_id: s.source_id,
      next_due_at: s.next_due_at,
      last_checked_at: s.last_checked_at,
      last_success_at: s.last_success_at,
      failure_count: s.failure_count,
      last_error_code: s.last_error_code,
      payload_json: JSON.stringify(s),
    },
    "update",
  );
}
export async function persistFailure(
  store: SqlStore,
  previous: SourceState,
  failed: SourceState,
) {
  const guard = `failure_${randomUUID()}`;
  await store.batch([
    {
      sql: "INSERT INTO write_guards(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM source_state WHERE source_id=? AND payload_json=?) THEN 1 ELSE 0 END",
      params: [guard, previous.source_id, JSON.stringify(previous)],
    },
    stateStatement(failed),
    { sql: "DELETE FROM write_guards WHERE id=?", params: [guard] },
  ]);
}
export interface CollectionExtras {
  /** Commits por día UTC (fecha del commit). Sustituye al recuento por evento. */
  commitDaily?: Record<string, number>;
  /** Estado de avances actualizado del proyecto, si cambió. */
  progress?: { project_id: string; state: ProgressState };
}
export async function persistCollection(
  store: SqlStore,
  previous: SourceState,
  result: { events: Observation[]; state: SourceState; repository: Repository },
  extras: CollectionExtras = {},
) {
  const guard = `cursor_${randomUUID()}`,
    r = result.repository;
  const statements: Statement[] = [
    {
      sql: "INSERT INTO write_guards(id,ok) SELECT ?, CASE WHEN EXISTS(SELECT 1 FROM source_state WHERE source_id=? AND payload_json=?) THEN 1 ELSE 0 END",
      params: [guard, previous.source_id, JSON.stringify(previous)],
    },
    insert(
      "repositories",
      {
        id: r.id,
        project_id: r.project_id,
        provider: "github",
        provider_repo_id: r.provider_repo_id,
        owner: r.owner,
        name: r.name,
        canonical_url: r.canonical_url,
        payload_json: JSON.stringify(r),
      },
      "update",
    ),
  ];
  for (const [day, count] of Object.entries(extras.commitDaily ?? {}))
    statements.push({
      sql: "INSERT INTO event_daily(source_id,day_utc,event_type,project_id,event_count,compacted_at) VALUES (?,?,?,?,?,?) ON CONFLICT(source_id,day_utc,event_type) DO UPDATE SET event_count=event_count+excluded.event_count,compacted_at=excluded.compacted_at",
      params: [
        previous.source_id,
        day,
        "commit",
        r.project_id,
        count,
        result.state.last_checked_at ?? day,
      ],
    });
  if (extras.progress)
    statements.push(
      insert(
        "pipeline_state",
        {
          key: `progress:${extras.progress.project_id}`,
          value_json: JSON.stringify(extras.progress.state),
        },
        "update",
      ),
    );
  for (const e of result.events) {
    if (!(extras.commitDaily && e.event_type === "commit"))
      statements.push({
        sql: "INSERT INTO event_daily(source_id,day_utc,event_type,project_id,event_count,compacted_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM events WHERE source_id=? AND external_id=?) ON CONFLICT(source_id,day_utc,event_type) DO UPDATE SET event_count=event_count+1,compacted_at=excluded.compacted_at",
        params: [
          e.source_id,
          e.observed_at.slice(0, 10),
          e.event_type,
          e.project_id,
          1,
          e.observed_at,
          e.source_id,
          e.external_id,
        ],
      });
    statements.push(
      insert("events", {
        id: e.id,
        source_id: e.source_id,
        project_id: e.project_id,
        external_id: e.external_id,
        event_type: e.event_type,
        source_published_at: e.source_published_at,
        observed_at: e.observed_at,
        content_hash: e.content_hash,
        payload_json: JSON.stringify(e),
      }),
    );
  }
  statements.push(stateStatement(result.state), {
    sql: "DELETE FROM write_guards WHERE id=?",
    params: [guard],
  });
  await store.batch(statements);
}
/** Commits con anuncio de avance que se guardan como evento por recogida. */
const MAX_NOTABLE_COMMITS = 20;
export async function readProgress(
  store: SqlStore,
  projectId: string,
): Promise<ProgressState> {
  const row = (
    await store.query<{ value_json: string }>(
      "SELECT value_json FROM pipeline_state WHERE key=?",
      [`progress:${projectId}`],
    )
  )[0];
  return row ? (JSON.parse(row.value_json) as ProgressState) : emptyProgress();
}
/**
 * Reduce una recogida a lo que merece guardarse y detecta avances anunciados.
 * Los commits se cuentan por día; solo se guardan los que anuncian un avance,
 * además de versiones publicadas y cambios de README (extractos, no el texto).
 */
export async function prepareCollection(
  store: SqlStore,
  project: Config["projects"][number] | undefined,
  result: {
    events: Observation[];
    state: SourceState;
    repository: Repository;
    readme?: { sha: string; text: string } | null;
  },
  now: string,
) {
  const options = {
    multiTitle: project?.title_scope === "multi_title",
    aliases: project?.gta_aliases,
  };
  const signals: ProgressSignal[] = [];
  const events: Observation[] = [];
  const commitDaily: Record<string, number> = {};
  let notable = 0;
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  for (const e of result.events) {
    const at = e.source_published_at ?? now;
    if (e.event_type === "commit") {
      const day = at.slice(0, 10);
      commitDaily[day] = (commitDaily[day] ?? 0) + 1;
      const found = detect(
        {
          source_type: "commit",
          text: text(e.payload.message),
          ref: text(e.payload.url) || null,
          at,
        },
        options,
      );
      if (found.length && notable < MAX_NOTABLE_COMMITS) {
        notable++;
        events.push(e);
        signals.push(...found);
      }
    } else {
      events.push(e);
      if (e.event_type === "release")
        signals.push(
          ...detect(
            {
              source_type: "release",
              text: `${text(e.payload.name)}
${text(e.payload.tag)}
${text(e.payload.summary)}`,
              ref: text(e.payload.url) || null,
              at,
            },
            options,
          ),
        );
    }
  }
  if (result.readme) {
    const found = detect(
      {
        source_type: "readme",
        text: result.readme.text,
        ref: `${result.repository.canonical_url}#readme`,
        at: now,
      },
      options,
    );
    signals.push(...found);
    const payload = {
      sha: result.readme.sha,
      excerpts: found.map((f) => ({ step: f.step, excerpt: f.excerpt })),
      lines: relevantLines(result.readme.text, 10).map((l) => l.slice(0, 200)),
    };
    const external = `readme:${result.repository.provider_repo_id}:${result.readme.sha}`;
    events.push({
      id: `evt_${hash([result.state.source_id, external]).slice(0, 32)}`,
      source_id: result.state.source_id,
      project_id: result.repository.project_id,
      external_id: external,
      event_type: "readme",
      source_published_at: null,
      observed_at: now,
      content_hash: hash(payload),
      payload,
    });
  }
  let progress: CollectionExtras["progress"];
  if (project) {
    const previous = await readProgress(store, project.id);
    // Primera lectura, o relectura por reglas nuevas: lo que ya anunciaba el
    // proyecto es su punto de partida, no una novedad.
    const first = !previous.first_read_at && previous.updated_at === null;
    const relearn = (previous.rules ?? 1) < RULES_VERSION && !!result.readme;
    const merged = mergeProgress(
      previous,
      first || relearn ? signals.map((s) => ({ ...s, baseline: true })) : signals,
      now,
    );
    if (merged.changed || !previous.first_read_at || relearn)
      progress = {
        project_id: project.id,
        state: {
          ...merged.state,
          first_read_at: previous.first_read_at ?? now,
          rules: result.readme ? RULES_VERSION : previous.rules,
        },
      };
  }
  return {
    result: { ...result, events },
    extras: { commitDaily, progress } satisfies CollectionExtras,
  };
}
async function initialize(store: SqlStore, c: Config, rulesCommit: string) {
  const rubricRow = await store.query<{ definition_hash: string }>(
    "SELECT definition_hash FROM rubrics WHERE id=?",
    [c.rubric.id],
  );
  if (rubricRow[0] && rubricRow[0].definition_hash !== checksum(c.rubric))
    throw new Error("La rúbrica usada es inmutable");
  const statements: Statement[] = [
    insert("rubrics", {
      id: c.rubric.id,
      version: c.rubric.version,
      definition_hash: checksum(c.rubric),
      rules_commit: rulesCommit,
      payload_json: JSON.stringify(c.rubric),
    }),
  ];
  for (const m of c.rubric.milestones)
    statements.push(
      insert("milestones", {
        rubric_id: c.rubric.id,
        milestone_id: m.id,
        weight: m.weight,
        payload_json: JSON.stringify(m),
      }),
    );
  for (const p of c.projects)
    statements.push(
      insert(
        "projects",
        {
          id: p.id,
          slug: p.slug,
          name: p.name,
          project_type: p.project_type,
          review_status: p.review_status,
          ranking_eligible: p.ranking_eligible ? 1 : 0,
          created_at: p.created_at,
          updated_at: p.updated_at,
          payload_json: JSON.stringify(p),
        },
        "update",
      ),
    );
  for (const s of c.sources) {
    statements.push(
      insert(
        "sources",
        {
          id: s.id,
          project_id: s.project_id,
          adapter: s.adapter,
          enabled: s.enabled ? 1 : 0,
          priority: s.priority,
          canonical_url: s.canonical_url,
          payload_json: JSON.stringify(s),
        },
        "update",
      ),
    );
    const state = initialState(s.id);
    statements.push(
      insert("source_state", {
        source_id: s.id,
        next_due_at: state.next_due_at,
        last_checked_at: null,
        last_success_at: null,
        failure_count: 0,
        last_error_code: null,
        payload_json: JSON.stringify(state),
      }),
    );
  }
  await store.batch(statements);
}
async function persistReviews(store: SqlStore, c: Config) {
  const statements: Statement[] = [];
  const storedEvidence = await readEntities<Evidence>(store, "evidence"),
    storedAssessments = await readEntities<Assessment>(store, "assessments");
  for (const e of c.evidence) {
    const old = storedEvidence.find((o) => o.id === e.id);
    if (old && checksum(old) !== checksum(e))
      throw new Error("Modificar evidencia requiere un nuevo ID");
    statements.push(
      insert("evidence", {
        id: e.id,
        source_id: e.source_id,
        project_id: e.project_id,
        level: e.level,
        target_version: e.target_version,
        content_hash: e.content_hash,
        observed_at: e.observed_at,
        payload_json: JSON.stringify(e),
      }),
    );
  }
  for (const a of [...c.assessments].sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at),
  )) {
    const old = storedAssessments.find((o) => o.id === a.id);
    if (old && checksum(old) !== checksum(a))
      throw new Error("Evaluaciones añadidas, nunca sobrescritas");
    statements.push(
      insert("assessments", {
        id: a.id,
        project_id: a.project_id,
        rubric_id: a.rubric_id,
        milestone_id: a.milestone_id,
        state: a.state,
        target_version: a.target_version,
        reviewer: a.reviewer,
        review_commit: a.review_commit,
        effective_at: a.effective_at,
        recorded_at: a.recorded_at,
        supersedes_id: a.supersedes_id,
        payload_json: JSON.stringify(a),
      }),
    );
    for (const e of a.evidence_ids)
      statements.push(
        insert("assessment_evidence", {
          assessment_id: a.id,
          evidence_id: e,
          relation: "supports",
        }),
      );
    statements.push(
      insert("audit_log", {
        id: `assessment_${a.id}`,
        actor: a.reviewer,
        action: a.state,
        entity_type: "assessment",
        entity_id: a.id,
        reason: a.rationale,
        review_commit: a.review_commit,
        occurred_at: a.recorded_at,
        payload_json: JSON.stringify(a),
      }),
    );
  }
  await store.batch(statements);
}
export function validatePublication(
  p: Publication,
  c: Pick<Config, "budgets">,
  production = true,
): void {
  PublicationSchema.parse(p);
  if (
    production &&
    (p.mode === "demo" ||
      p.synthetic ||
      p.data.projects.some(
        (p) =>
          p.synthetic ||
          p.id.startsWith("project_fixture_") ||
          p.evidence.some(
            (e) => e.synthetic || e.id.startsWith("evidence_fixture_"),
          ) ||
          p.assessments.some(
            (a) => a.synthetic || a.id.startsWith("assessment_fixture_"),
          ),
      ))
  )
    throw new Error("Datos sintéticos rechazados en producción");
  if (new Set(p.data.projects.map((p) => p.id)).size !== p.data.projects.length)
    throw new Error("Proyecto duplicado en publicación");
  if (Buffer.byteLength(JSON.stringify(p)) > c.budgets.main_publication_bytes)
    throw new Error("Publicación excede presupuesto");
  for (const project of p.data.projects)
    if (Buffer.byteLength(JSON.stringify(project)) > c.budgets.detail_bytes)
      throw new Error("Ficha excede presupuesto");
  if (p.data.projects.some((p) => p.score.score < 0 || p.score.score > 100))
    throw new Error("Puntuación inválida");
}
export function publicationResources(p: Publication): Record<string, string> {
  const envelope = (data: unknown) =>
    JSON.stringify({
      schema_version: p.schema_version,
      publication_id: p.publication_id,
      generated_at: p.generated_at,
      last_collection_success_at: p.last_collection_success_at,
      mode: p.mode,
      data,
      warnings: p.warnings,
    });
  const resources: Record<string, string> = {
    latest: JSON.stringify(p),
    projects: envelope(p.data.projects),
    radar: envelope(p.data.candidates),
    methodology: envelope(p.data.rubric),
    status: envelope({
      health: p.data.health,
      sources: p.data.sources,
      runs: p.data.runs,
    }),
  };
  for (const project of p.data.projects) {
    resources[`projects/${project.id}`] = envelope(project);
    for (
      let i = 0;
      i < Math.max(1, Math.ceil(project.history.length / 50));
      i++
    )
      resources[`projects/${project.id}/history/${i}`] = envelope(
        project.history.slice(i * 50, (i + 1) * 50),
      );
  }
  return resources;
}
export async function publish(
  store: SqlStore,
  p: Publication,
  c: Pick<Config, "budgets">,
  runId: string | null,
  failBeforePointer = false,
) {
  validatePublication(p, c);
  const expected =
    (
      await store.query<{ publication_id: string }>(
        "SELECT publication_id FROM publication_pointer WHERE name=?",
        ["current"],
      )
    )[0]?.publication_id ?? null;
  const resources = publicationResources(p),
    manifest = checksum(
      Object.entries(resources).map(([key, body]) => [key, checksum(body)]),
    );
  await store.batch([
    insert("publications", {
      id: p.publication_id,
      schema_version: "1",
      generated_at: p.generated_at,
      last_collection_success_at: p.last_collection_success_at,
      source_run_id: runId,
      manifest_hash: manifest,
      status: "building",
      payload_json: JSON.stringify(p),
    }),
  ]);
  for (const [key, body] of Object.entries(resources)) {
    if (
      Buffer.byteLength(body) >
      (["latest", "projects"].includes(key)
        ? c.budgets.main_publication_bytes
        : c.budgets.detail_bytes)
    )
      throw new Error("Bloque excede presupuesto");
    await store.batch([
      insert("publication_blobs", {
        publication_id: p.publication_id,
        resource_key: key,
        body_json: body,
        body_hash: checksum(body),
        generated_at: p.generated_at,
      }),
    ]);
  }
  const stored = await store.query<{
    resource_key: string;
    body_json: string;
    body_hash: string;
  }>(
    "SELECT resource_key,body_json,body_hash FROM publication_blobs WHERE publication_id=? ORDER BY rowid",
    [p.publication_id],
  );
  if (
    stored.length !== Object.keys(resources).length ||
    stored.some((r) => r.body_hash !== checksum(r.body_json)) ||
    checksum(stored.map((r) => [r.resource_key, r.body_hash])) !== manifest
  )
    throw new Error("Publicación incompleta o corrupta");
  if (failBeforePointer)
    throw new Error("Interrupción de prueba antes del puntero");
  const guard = `publication_${randomUUID()}`;
  await store.batch([
    {
      sql: "INSERT INTO write_guards(id,ok) SELECT ?,CASE WHEN (SELECT publication_id FROM publication_pointer WHERE name='current') IS ? THEN 1 ELSE 0 END",
      params: [guard, expected],
    },
    {
      sql: "UPDATE publications SET status='complete' WHERE id=? AND status='building'",
      params: [p.publication_id],
    },
    {
      sql: "INSERT INTO publication_pointer(name,publication_id,updated_at) VALUES ('current',?,?) ON CONFLICT(name) DO UPDATE SET publication_id=excluded.publication_id,updated_at=excluded.updated_at",
      params: [p.publication_id, p.generated_at],
    },
    { sql: "DELETE FROM write_guards WHERE id=?", params: [guard] },
  ]);
}
export async function currentPublication(
  store: SqlStore,
): Promise<Publication | null> {
  const row = (
    await store.query<{ body_json: string }>(
      "SELECT b.body_json FROM publication_pointer p JOIN publication_blobs b ON b.publication_id=p.publication_id AND b.resource_key='latest' WHERE p.name='current'",
    )
  )[0];
  return row ? JSON.parse(row.body_json) : null;
}
export async function buildPublication(
  store: SqlStore,
  c: Config,
  now: string,
  run: Run,
): Promise<Publication> {
  const assessments = await readEntities<Assessment>(store, "assessments"),
    evidence = await readEntities<Evidence>(store, "evidence"),
    eventRows = await store.query<{ payload_json: string }>(
      "SELECT payload_json FROM events ORDER BY observed_at DESC LIMIT 30",
    ),
    states = await readEntities<SourceState>(store, "source_state"),
    historyRows = await store.query<{ payload_json: string }>(
      "SELECT payload_json FROM score_history ORDER BY recorded_at,rowid",
    ),
    repos = await readEntities<Repository>(store, "repositories");
  const history: ScorePoint[] = historyRows.map((r) =>
    JSON.parse(r.payload_json),
  );
  const events: Observation[] = eventRows.map((r) =>
    JSON.parse(r.payload_json),
  );
  const daily = await store.query<{
    project_id: string | null;
    activity_7d: number;
    activity_30d: number;
  }>(
    "SELECT project_id,sum(CASE WHEN day_utc>=? THEN event_count ELSE 0 END) AS activity_7d,sum(event_count) AS activity_30d FROM event_daily WHERE day_utc>=? GROUP BY project_id",
    [
      new Date(Date.parse(now) - 6 * 86400000).toISOString().slice(0, 10),
      new Date(Date.parse(now) - 29 * 86400000).toISOString().slice(0, 10),
    ],
  );
  for (const a of assessments) {
    const project = c.projects.find((p) => p.id === a.project_id);
    if (project)
      validateAssessment(
        a,
        evidence,
        project,
        c.reviewersAt(a.recorded_at),
        c.rubric,
      );
  }
  const sources: SourceView[] = c.sources.map((s) => {
    const st = states.find((st) => st.source_id === s.id) ?? initialState(s.id);
    return {
      ...s,
      last_checked_at: st.last_checked_at,
      last_success_at: st.last_success_at,
      failure_count: st.failure_count,
      last_error_code: st.last_error_code,
    };
  });
  const relations = repos
    .map((r) => declaredFork(r, repos))
    .filter((r): r is Relation => r !== null);
  const progressRows = await store.query<{ key: string; value_json: string }>(
    "SELECT key,value_json FROM pipeline_state WHERE key LIKE 'progress:%'",
  );
  const progressOf = (id: string): ProgressState =>
    progressRows.find((r) => r.key === `progress:${id}`)
      ? JSON.parse(
          progressRows.find((r) => r.key === `progress:${id}`)!.value_json,
        )
      : emptyProgress();
  const days = Array.from({ length: 14 }, (_, i) =>
    new Date(Date.parse(now) - (13 - i) * 86400000).toISOString().slice(0, 10),
  );
  const commitRows = await store.query<{
    project_id: string | null;
    day_utc: string;
    n: number;
  }>(
    "SELECT project_id,day_utc,sum(event_count) AS n FROM event_daily WHERE event_type='commit' AND day_utc>=? GROUP BY project_id,day_utc",
    [days[0]],
  );
  const views: ProjectView[] = c.projects.map((p) => {
    const ps = sources.filter((s) => s.project_id === p.id),
      activity = daily.find((d) => d.project_id === p.id),
      score = calculateScore(
        p,
        c.target_versions[p.id],
        assessments,
        c.rubric,
        now,
      );
    return {
      ...p,
      score,
      assessments: assessments.filter((a) => a.project_id === p.id),
      evidence: evidence.filter((e) => e.project_id === p.id),
      relations: relations.filter(
        (r) => r.from_project_id === p.id || r.to_project_id === p.id,
      ),
      history: history.filter((h) => h.project_id === p.id),
      last_checked_at:
        ps
          .map((s) => s.last_success_at)
          .filter((d): d is string => !!d)
          .sort()
          .at(-1) ?? null,
      progress: (() => {
        const st = revalidate(progressOf(p.id));
        return {
          ladder: "vi-avance-v1" as const,
          level: progressLevel(st),
          steps: Object.values(st.steps)
            .filter((x): x is ProgressSignal => !!x)
            .sort((a, b) => a.step.localeCompare(b.step)),
          updated_at: st.updated_at,
        };
      })(),
      stats: repos.find((r) => r.project_id === p.id && r.stats)?.stats ?? null,
      activity_daily: days.map(
        (d) =>
          commitRows.find((r) => r.project_id === p.id && r.day_utc === d)?.n ??
          0,
      ),
      activity_7d: activity?.activity_7d ?? 0,
      activity_30d: activity?.activity_30d ?? 0,
      last_confirmed_at:
        assessments
          .filter(
            (a) =>
              a.project_id === p.id &&
              score.contributions.some(
                (c) => c.points > 0 && c.assessment_id === a.id,
              ),
          )
          .map((a) => a.effective_at)
          .sort()
          .at(-1) ?? null,
      rank: null,
    };
  });
  const scoreStatements: Statement[] = [];
  for (const p of views) {
    const inputHash = checksum({
      project: {
        id: p.id,
        ranking_eligible: p.ranking_eligible,
        project_type: p.project_type,
        review_status: p.review_status,
      },
      version: c.target_versions[p.id],
      rubric: c.rubric,
      assessments: p.assessments,
      score: p.score,
      rules_commit: run.code_commit,
    });
    const last = p.history.at(-1);
    if (!last || last.input_hash !== inputHash) {
      const point: ScorePoint = {
        project_id: p.id,
        rubric_id: c.rubric.id,
        score: p.score.score,
        confirmed_count: p.score.confirmed_count,
        effective_at: now,
        recorded_at: now,
        cause_assessment_id: p.assessments.at(-1)?.id ?? null,
        input_hash: inputHash,
        rules_commit: run.code_commit,
      };
      scoreStatements.push(
        insert("score_history", {
          id: `score_${randomUUID()}`,
          project_id: p.id,
          rubric_id: c.rubric.id,
          score: point.score,
          confirmed_count: point.confirmed_count,
          effective_at: now,
          recorded_at: now,
          cause_assessment_id: point.cause_assessment_id,
          input_hash: inputHash,
          rules_commit: run.code_commit,
          payload_json: JSON.stringify(point),
        }),
      );
      p.history.push(point);
    }
  }
  await store.batch(scoreStatements);
  const runs = (await readEntities<Run>(store, "pipeline_runs"))
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 10);
  const candidates = await readEntities<Candidate>(
    store,
    "discovery_candidates",
  );
  const discovery = await store.query<{ value_json: string }>(
    "SELECT value_json FROM pipeline_state WHERE key='discovery'",
  );
  return {
    schema_version: "1",
    publication_id: `pub_${now.replace(/[^0-9]/g, "")}_${randomUUID().slice(0, 8)}`,
    generated_at: now,
    last_collection_success_at:
      sources
        .map((s) => s.last_success_at)
        .filter((x): x is string => !!x)
        .sort()
        .at(-1) ?? null,
    mode: "normal",
    data: {
      projects: rankProjects(views),
      // Radar público acotado: pendientes y seguidos completos, rechazos recientes.
      candidates: (() => {
        const all = duplicationSignals(candidates).sort((a, b) =>
          b.last_seen_at.localeCompare(a.last_seen_at),
        );
        return [
          ...all.filter((x) => x.status !== "rejected").slice(0, 150),
          ...all.filter((x) => x.status === "rejected").slice(0, 60),
        ];
      })(),
      sources,
      rubric: c.rubric,
      events: events
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
        .slice(0, 30),
      runs,
      discovery_last_success_at: discovery[0]
        ? JSON.parse(discovery[0].value_json).last_success_at
        : null,
      health: globalHealth(sources, Date.parse(now)),
    },
    warnings:
      run.status === "partial"
        ? [
            "Algunas fuentes no han podido comprobarse; se conserva su información anterior.",
          ]
        : [],
  };
}
/** Proyectos admitidos por el Radar automático, como si estuvieran configurados. */
export function withAutoTracked(c: Config, candidates: Candidate[]): Config {
  const known = new Set(c.sources.map((s) => s.provider_repo_id));
  const room = Math.max(0, c.budgets.max_projects - c.projects.length);
  const auto = candidates
    .filter(
      (x) =>
        x.status === "accepted" &&
        x.linked_project_id?.startsWith("project_auto_") &&
        !known.has(x.provider_repo_id),
    )
    .sort((a, b) => (b.repo?.stars ?? 0) - (a.repo?.stars ?? 0))
    .slice(0, room);
  if (!auto.length) return c;
  const projects = auto.map((x) => {
    const gta = /\b(gta|grand theft auto|leonida|vice city)\b/i.test(
      `${x.name} ${x.description}`,
    );
    return {
      id: x.linked_project_id!,
      slug: `auto-${x.provider_repo_id}`,
      name: x.name.split("/")[1]?.slice(0, 160) || x.name.slice(0, 160),
      description: (x.description || "Sin descripción pública.").slice(0, 2000),
      project_type: "full_route" as const,
      category: "Detectado automáticamente",
      review_status: "accepted" as const,
      maintenance_status: "active" as const,
      ranking_eligible: false,
      official_url: x.canonical_url,
      title_scope: gta ? ("gta_vi" as const) : ("multi_title" as const),
      created_at: x.first_seen_at,
      updated_at: x.last_seen_at,
    };
  });
  const sources = auto.map((x) => ({
    id: `source_gh_${x.provider_repo_id}`,
    project_id: x.linked_project_id!,
    adapter: "github" as const,
    repository: x.name,
    provider_repo_id: x.provider_repo_id,
    enabled: true,
    priority: "secondary" as const,
    interval_minutes: 60,
    canonical_url: x.canonical_url,
    terms_url:
      "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
    access_notes:
      "Admitido por el Radar automático. API REST pública de GitHub; sin descargar ni ejecutar código.",
  }));
  return {
    ...c,
    projects: [...c.projects, ...projects],
    sources: [...c.sources, ...sources],
    target_versions: {
      ...c.target_versions,
      ...Object.fromEntries(
        projects.map((p) => [p.id, "Xbox Series (build pública)"]),
      ),
    },
  };
}
export async function runCycle(
  store: SqlStore,
  config: Config,
  client: GitHubClient,
  now: string,
  rulesCommit = "0000000000000000000000000000000000000000",
) {
  assertProductionInputs(config);
  const c = withAutoTracked(
    config,
    await readEntities<Candidate>(store, "discovery_candidates"),
  );
  const start = Date.now(),
    run: Run = {
      id: `run_${randomUUID()}`,
      started_at: now,
      finished_at: null,
      status: "running",
      code_commit: rulesCommit,
      metrics: {},
      error_summary: null,
    };
  const saveRun = () =>
    store.batch([
      insert(
        "pipeline_runs",
        {
          id: run.id,
          started_at: run.started_at,
          finished_at: run.finished_at,
          status: run.status,
          payload_json: JSON.stringify(run),
        },
        "update",
      ),
    ]);
  await initialize(store, c, rulesCommit);
  await saveRun();
  const errors: string[] = [];
  try {
    for (const source of c.sources
      .filter((s) => s.enabled && c.features.github_enabled)
      .sort((a, b) => a.priority.localeCompare(b.priority))) {
      if (Date.now() - start > (c.budgets.max_job_seconds - 30) * 1000) {
        errors.push("time_budget");
        break;
      }
      const state = (
        await readEntities<SourceState>(store, "source_state")
      ).find((s) => s.source_id === source.id)!;
      if (state.next_due_at > now) continue;
      try {
        // Reglas de detección nuevas: se vuelve a pedir el README sin ETag.
        const rules = source.project_id
          ? ((await readProgress(store, source.project_id)).rules ?? 1)
          : RULES_VERSION;
        const collected = await client.collect(
          source,
          rules < RULES_VERSION ? { ...state, readme_etag: null } : state,
          now,
        );
        const prepared = await prepareCollection(
          store,
          c.projects.find((p) => p.id === source.project_id),
          collected,
          now,
        );
        await persistCollection(store, state, prepared.result, prepared.extras);
      } catch (e) {
        if (!(e instanceof CollectionError)) throw e;
        const code = e.code;
        errors.push(`${source.id}:${code}`);
        const failed = {
          ...state,
          last_checked_at: now,
          failure_count: state.failure_count + 1,
          last_error_code: code,
          next_due_at:
            e instanceof CollectionError && e.retry_at
              ? e.retry_at
              : new Date(
                  Date.parse(now) + source.interval_minutes * 60000,
                ).toISOString(),
        };
        await persistFailure(store, state, failed);
        if (["rate_limited", "budget_exhausted"].includes(code)) break;
      }
    }
    const discoveryState = (
      await store.query<{ value_json: string }>(
        "SELECT value_json FROM pipeline_state WHERE key='discovery'",
      )
    )[0];
    const discovery = discoveryState
      ? JSON.parse(discoveryState.value_json)
      : { next_due_at: null, last_success_at: null };
    if (
      c.discovery.enabled &&
      c.features.github_enabled &&
      (!discovery.next_due_at || discovery.next_due_at <= now)
    ) {
      try {
        let incoming: Candidate[] = [];
        let queryCount = 0;
        for (let i = 0; i < c.discovery.queries.length; i++) {
          const q =
            c.discovery.queries[
              ((discovery.next_query_index ?? 0) + i) %
                c.discovery.queries.length
            ];
          incoming.push(
            ...(await client.discover(q, now, c.discovery.max_pages)),
          );
          queryCount++;
          if (incoming.length >= c.budgets.max_candidates) break;
        }
        const previous = await readEntities<Candidate>(
          store,
          "discovery_candidates",
        );
        const tracked = new Map(
          c.sources
            .filter((s) => s.provider_repo_id && s.project_id)
            .map((s) => [s.provider_repo_id!, s.project_id!]),
        );
        const statements = applyClassification(
          mergeCandidates(
            previous,
            incoming.slice(0, c.budgets.max_candidates),
          ),
          tracked,
        ).map((candidate) =>
          insert(
            "discovery_candidates",
            {
              id: candidate.id,
              provider: "github",
              provider_repo_id: candidate.provider_repo_id,
              status: candidate.status,
              first_seen_at: candidate.first_seen_at,
              last_seen_at: candidate.last_seen_at,
              linked_project_id: candidate.linked_project_id,
              payload_json: JSON.stringify(candidate),
            },
            "update",
          ),
        );
        statements.push(
          insert(
            "pipeline_state",
            {
              key: "discovery",
              value_json: JSON.stringify({
                last_success_at: now,
                next_query_index:
                  ((discovery.next_query_index ?? 0) + queryCount) %
                  Math.max(1, c.discovery.queries.length),
                next_due_at: new Date(
                  Date.parse(now) + c.discovery.interval_minutes * 60000,
                ).toISOString(),
              }),
            },
            "update",
          ),
        );
        await store.batch(statements);
      } catch (e) {
        errors.push(
          `discovery:${e instanceof CollectionError ? e.code : "failed"}`,
        );
        await store.batch([
          insert(
            "pipeline_state",
            {
              key: "discovery",
              value_json: JSON.stringify({
                ...discovery,
                last_error_code:
                  e instanceof CollectionError ? e.code : "failed",
                next_due_at:
                  e instanceof CollectionError && e.retry_at
                    ? e.retry_at
                    : new Date(
                        Date.parse(now) + c.discovery.interval_minutes * 60000,
                      ).toISOString(),
              }),
            },
            "update",
          ),
        ]);
      }
    }
    for (const review of c.candidateReviews) {
      const candidates = await readEntities<Candidate>(
          store,
          "discovery_candidates",
        ),
        old = candidates.find((c) => c.id === review.candidate_id);
      // La decisión se aplica cuando el candidato exista en esta base; una base
      // nueva o restaurada sin ese candidato no debe bloquear el ciclo.
      if (!old) continue;
      const candidate = applyCandidateReview(
        old,
        review,
        c.reviewersAt(review.occurred_at),
      );
      await store.batch([
        insert(
          "discovery_candidates",
          {
            id: candidate.id,
            provider: "github",
            provider_repo_id: candidate.provider_repo_id,
            status: candidate.status,
            first_seen_at: candidate.first_seen_at,
            last_seen_at: candidate.last_seen_at,
            linked_project_id: candidate.linked_project_id,
            payload_json: JSON.stringify(candidate),
          },
          "update",
        ),
        insert("audit_log", {
          id: review.id,
          actor: review.reviewer,
          action: review.status,
          entity_type: "candidate",
          entity_id: review.candidate_id,
          reason: review.reason,
          review_commit: review.review_commit,
          occurred_at: review.occurred_at,
          payload_json: JSON.stringify(review),
        }),
      ]);
    }
    await persistReviews(store, c);
    run.finished_at = new Date(
      Date.parse(now) + Date.now() - start,
    ).toISOString();
    run.status = errors.length ? "partial" : "success";
    run.metrics = {
      github_requests: client.requests,
      duration_ms: Date.now() - start,
    };
    run.error_summary = errors.join("; ") || null;
    await saveRun();
    const publication = await buildPublication(store, c, now, run);
    await publish(store, publication, c, run.id);
    return { run, publication };
  } catch (e) {
    run.status = "failed";
    run.finished_at = new Date(
      Date.parse(now) + Date.now() - start,
    ).toISOString();
    run.error_summary =
      "Fallo de validación o persistencia; publicación anterior conservada";
    await saveRun();
    throw e;
  }
}
