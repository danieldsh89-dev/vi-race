import { beforeEach, afterEach, it, expect } from "vitest";
import {
  LocalStore,
  insert,
  readEntities,
  exportBackup,
  restoreBackup,
  checksum,
} from "@vi/storage";
import type {
  Publication,
  SourceState,
  Observation,
  Repository,
} from "@vi/contracts";
import {
  runCycle,
  initialState,
  persistCollection,
  persistFailure,
  publish,
  currentPublication,
} from "../scripts/pipeline";
import { loadConfig } from "../scripts/config";
import { GitHubClient } from "@vi/collectors";
import {
  demoPublication,
  fixtureAssessment,
  fixtureEvidence,
  fixtureProject,
} from "./fixtures/demo";
const config = loadConfig(),
  date = "2026-11-24T12:00:00.000Z";
let store: LocalStore;
beforeEach(() => {
  store = new LocalStore();
  store.migrate();
});
afterEach(() => store.close());
function empty(id = "pub_test_1"): Publication {
  return {
    schema_version: "1",
    publication_id: id,
    generated_at: date,
    last_collection_success_at: null,
    mode: "normal",
    data: {
      projects: [],
      sources: [],
      events: [],
      candidates: [],
      runs: [],
      rubric: config.rubric,
      discovery_last_success_at: null,
      health: "unknown",
    },
    warnings: [],
  };
}
it("aplica migraciones desde cero e índices", async () => {
  expect(await store.query("PRAGMA foreign_key_check")).toEqual([]);
  expect(
    await store.query(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_due'",
    ),
  ).toHaveLength(1);
});
it("un lote fallido se revierte por completo", async () => {
  await expect(
    store.batch([
      insert("pipeline_state", { key: "first", value_json: "{}" }),
      { sql: "INSERT INTO write_guards VALUES ('invalid',0)" },
    ]),
  ).rejects.toThrow();
  expect(await store.query("SELECT * FROM pipeline_state")).toEqual([]);
});
async function seedState() {
  const state = initialState("s1");
  await store.batch([
    insert("sources", {
      id: "s1",
      project_id: null,
      adapter: "github",
      enabled: 1,
      priority: "primary",
      canonical_url: "https://github.com/a/b",
      payload_json: "{}",
    }),
    insert("source_state", {
      source_id: state.source_id,
      next_due_at: state.next_due_at,
      last_checked_at: null,
      last_success_at: null,
      failure_count: 0,
      last_error_code: null,
      payload_json: JSON.stringify(state),
    }),
  ]);
  return state;
}
function collected(previous: SourceState) {
  const event: Observation = {
    id: "evt_test",
    source_id: "s1",
    project_id: null,
    external_id: "commit:42:a",
    event_type: "commit",
    source_published_at: date,
    observed_at: date,
    content_hash: "a".repeat(64),
    payload: { message: "test" },
  };
  const repository: Repository = {
    id: "gh_42",
    project_id: null,
    provider_repo_id: "42",
    owner: "a",
    name: "b",
    canonical_url: "https://github.com/a/b",
    default_branch: "main",
    head_sha: "a",
    archived: false,
    parent_id: null,
  };
  return {
    events: [event],
    repository,
    state: {
      ...previous,
      cursor: { since: date, head_sha: "a" },
      next_due_at: date,
      last_checked_at: date,
      last_success_at: date,
    },
  };
}
it("eventos y cursor se guardan atómicamente y no se duplican", async () => {
  let previous = await seedState();
  await persistCollection(store, previous, collected(previous));
  previous = (await readEntities<SourceState>(store, "source_state"))[0];
  await persistCollection(store, previous, collected(previous));
  expect(await store.query("SELECT * FROM events")).toHaveLength(1);
  expect(
    (await readEntities<SourceState>(store, "source_state"))[0].cursor.since,
  ).toBe(date);
});
it("un fallo antes de persistir no adelanta cursor", async () => {
  const previous = await seedState();
  const bad = collected(previous);
  bad.events[0].source_id = "missing";
  await expect(persistCollection(store, previous, bad)).rejects.toThrow();
  expect((await readEntities<SourceState>(store, "source_state"))[0]).toEqual(
    previous,
  );
  expect(await store.query("SELECT * FROM repositories")).toHaveLength(0);
});
it("rechaza escritores con cursor antiguo", async () => {
  const previous = await seedState();
  await persistCollection(store, previous, collected(previous));
  await expect(
    persistCollection(store, previous, collected(previous)),
  ).rejects.toThrow();
  expect(await store.query("SELECT * FROM events")).toHaveLength(1);
});
it("un fallo concurrente no hace retroceder el cursor ya guardado", async () => {
  const previous = await seedState();
  await persistCollection(store, previous, collected(previous));
  await expect(
    persistFailure(store, previous, {
      ...previous,
      last_error_code: "timeout",
    }),
  ).rejects.toThrow();
  expect(
    (await readEntities<SourceState>(store, "source_state"))[0].cursor.since,
  ).toBe(date);
});
it("texto externo con la palabra fixture no bloquea una publicación real", async () => {
  const publication = empty();
  publication.warnings = [
    "Un repositorio público contiene tests_fixture_loader y synthetic:true como texto",
  ];
  await publish(store, publication, config, null);
  expect((await currentPublication(store))?.publication_id).toBe(
    publication.publication_id,
  );
});
it("restaurar sobre una base no vacía se rechaza de forma explícita", async () => {
  await publish(store, empty(), config, null);
  const backup = await exportBackup(store, date);
  await expect(restoreBackup(store, backup)).rejects.toThrow("base vacía");
});
it("un fallo de checksum al restaurar revierte el lote completo", async () => {
  const backup = await exportBackup(store, date);
  backup.tables.pipeline_state = [
    { key: "duplicate", value_json: "{}" },
    { key: "duplicate", value_json: '{"changed":true}' },
  ];
  backup.checksum = checksum(backup.tables);
  await expect(restoreBackup(store, backup)).rejects.toThrow("no coincide");
  expect(await store.query("SELECT * FROM pipeline_state")).toHaveLength(0);
});
it("conserva publicación anterior ante interrupción antes del puntero", async () => {
  await publish(store, empty(), config, null);
  await expect(
    publish(store, empty("pub_test_2"), config, null, true),
  ).rejects.toThrow();
  expect((await currentPublication(store))?.publication_id).toBe("pub_test_1");
  expect(
    (
      await store.query<{ status: string }>(
        "SELECT status FROM publications WHERE id=?",
        ["pub_test_2"],
      )
    )[0].status,
  ).toBe("building");
});
it("rechaza fixtures en producción antes de escribir", async () => {
  await expect(
    publish(store, demoPublication(config.rubric), config, null),
  ).rejects.toThrow("sintéticos");
  expect(await store.query("SELECT * FROM publications")).toEqual([]);
});
it("impide modificar blobs de una publicación completa", async () => {
  await publish(store, empty(), config, null);
  await expect(
    store.batch([
      {
        sql: "UPDATE publication_blobs SET body_json='{}' WHERE publication_id='pub_test_1'",
      },
    ]),
  ).rejects.toThrow();
});
it("no permite apuntar a una publicación incompleta", async () => {
  await publish(store, empty(), config, null);
  await expect(
    publish(store, empty("pub_test_2"), config, null, true),
  ).rejects.toThrow();
  await expect(
    store.batch([
      { sql: "UPDATE publication_pointer SET publication_id='pub_test_2'" },
    ]),
  ).rejects.toThrow();
});
it("restaura copia normalizada con hashes y referencias iguales", async () => {
  await publish(store, empty(), config, null);
  const backup = await exportBackup(store, date),
    copy = new LocalStore();
  copy.migrate();
  try {
    await restoreBackup(copy, backup);
    expect(checksum(await currentPublication(copy))).toBe(
      checksum(await currentPublication(store)),
    );
    expect(await copy.query("PRAGMA foreign_key_check")).toEqual([]);
    const broken = structuredClone(backup);
    broken.tables.projects.push({ id: "tampered" });
    await expect(restoreBackup(copy, broken)).rejects.toThrow("inválido");
  } finally {
    copy.close();
  }
});
it("dos ciclos sin red publican los proyectos configurados sin avances inventados", async () => {
  const c = {
    ...config,
    discovery: { ...config.discovery, enabled: false },
    features: { ...config.features, github_enabled: false },
  };
  await runCycle(store, c, new GitHubClient(undefined, c.budgets), date);
  await runCycle(
    store,
    c,
    new GitHubClient(undefined, c.budgets),
    "2026-11-24T12:10:00.000Z",
  );
  const projects = (await currentPublication(store))!.data.projects;
  expect(projects).toHaveLength(config.projects.length);
  expect(projects.every((p) => p.progress.level === 0)).toBe(true);
  expect(projects.every((p) => p.score.score === 0)).toBe(true);
  expect(await store.query("SELECT * FROM pipeline_runs")).toHaveLength(2);
  expect(await store.query("SELECT * FROM rubrics")).toHaveLength(1);
});
it("registra el cambio efectivo de puntuación y de elegibilidad aunque no cambien las evaluaciones", async () => {
  const project = {
      ...fixtureProject("project_test", "Proyecto de prueba"),
      synthetic: false,
    },
    evidence = fixtureEvidence(project.id).map((e, i) => ({
      ...e,
      synthetic: false,
      id: `e_test_${i}`,
      source_id: "source_test",
    }));
  const assessment = {
    ...fixtureAssessment("M01", project.id),
    synthetic: false,
    id: "a_test",
    evidence_ids: evidence.map((e) => e.id),
    effective_at: "2026-11-24T13:00:00.000Z",
    recorded_at: "2026-11-24T11:00:00.000Z",
  };
  const source = {
    id: "source_test",
    project_id: project.id,
    adapter: "github" as const,
    repository: "a/b",
    provider_repo_id: "42",
    enabled: false,
    priority: "primary" as const,
    interval_minutes: 10,
    canonical_url: "https://github.com/a/b",
    terms_url: "https://docs.github.com/en/site-policy",
    access_notes: "Test local",
  };
  const c = {
    ...config,
    projects: [project],
    target_versions: { [project.id]: "fixture-v1" },
    sources: [source],
    evidence,
    assessments: [assessment],
    reviewers: ["reviewer_fixture"],
    reviewersAt: () => ["reviewer_fixture"],
    discovery: { ...config.discovery, enabled: false },
  };
  const client = new GitHubClient(undefined, c.budgets);
  await runCycle(store, c, client, date);
  await runCycle(store, c, client, "2026-11-24T14:00:00.000Z");
  await runCycle(
    store,
    { ...c, projects: [{ ...project, ranking_eligible: false }] },
    client,
    "2026-11-24T15:00:00.000Z",
  );
  await runCycle(store, c, client, "2026-11-24T16:00:00.000Z");
  expect(
    (
      await store.query<{ score: number }>(
        "SELECT score FROM score_history ORDER BY rowid",
      )
    ).map((h) => h.score),
  ).toEqual([0, 3, 0, 3]);
  expect(
    (await currentPublication(store))!.data.projects[0].history.map(
      (h) => h.score,
    ),
  ).toEqual([0, 3, 0, 3]);
});
it("rechaza una entidad sintética renombrada antes de guardar filas append-only", async () => {
  const c = {
    ...config,
    projects: [fixtureProject("renamed_project", "Renombrado")],
    evidence: [],
    assessments: [],
    discovery: { ...config.discovery, enabled: false },
  };
  await expect(
    runCycle(store, c, new GitHubClient(undefined, c.budgets), date),
  ).rejects.toThrow("sintética");
  expect(await store.query("SELECT * FROM projects")).toHaveLength(0);
  expect(await store.query("SELECT * FROM assessments")).toHaveLength(0);
});
it("fallo de Radar conserva candidatos y fuente 404 no avanza cursor", async () => {
  const source = {
    id: "s1",
    project_id: null,
    adapter: "github" as const,
    repository: "a/b",
    provider_repo_id: "42",
    enabled: true,
    priority: "primary" as const,
    interval_minutes: 10,
    canonical_url: "https://github.com/a/b",
    terms_url: "https://docs.github.com/en/site-policy",
    access_notes: "Test",
  };
  const c = { ...config, sources: [source] };
  const fake: typeof fetch = async () => new Response("{}", { status: 404 });
  const r = await runCycle(
    store,
    c,
    new GitHubClient(undefined, c.budgets, fake),
    date,
  );
  expect(r.run.status).toBe("partial");
  expect(
    (await readEntities<SourceState>(store, "source_state"))[0].cursor.since,
  ).toBeNull();
  expect(
    (await readEntities<SourceState>(store, "source_state"))[0].failure_count,
  ).toBe(1);
});
