import { it, expect } from "vitest";
import { LocalStore, readEntities } from "@vi/storage";
import type { Observation, SourceState } from "@vi/contracts";
import { loadConfig } from "../scripts/config";
import {
  initialState,
  persistCollection,
  prepareCollection,
  readProgress,
  runCycle,
} from "../scripts/pipeline";
import { GitHubClient } from "@vi/collectors";
const config = loadConfig();
const now = "2026-11-24T12:00:00.000Z";
const project = config.projects.find((p) => p.title_scope === "gta_vi")!;
const source = config.sources.find((s) => s.project_id === project.id)!;
const event = (
  n: number,
  type: "commit" | "release",
  payload: Record<string, unknown>,
  at = now,
): Observation => ({
  id: `evt_${type}_${n}`,
  source_id: source.id,
  project_id: project.id,
  external_id: `${type}:${n}`,
  event_type: type,
  source_published_at: at,
  observed_at: now,
  content_hash: "a".repeat(64),
  payload,
});
it("una recogida cuenta commits por día y guarda solo lo que anuncia avances", async () => {
  const store = new LocalStore();
  store.migrate();
  const c = {
    ...config,
    discovery: { ...config.discovery, enabled: false },
    features: { ...config.features, github_enabled: false },
  };
  await runCycle(store, c, new GitHubClient(undefined, c.budgets), now);
  const state =
    (await readEntities<SourceState>(store, "source_state")).find(
      (s) => s.source_id === source.id,
    ) ?? initialState(source.id);
  const events = [
    ...Array.from({ length: 30 }, (_, i) =>
      event(i, "commit", { message: `refactor module ${i}`, url: null }),
    ),
    event(100, "commit", {
      message: "Now reaches the title screen",
      url: "https://github.com/x/y/commit/1",
    }),
    event(101, "release", {
      name: "v0.3",
      tag: "v0.3",
      summary: "Boots into the game and renders the first frame.",
      url: "https://github.com/x/y/releases/1",
    }),
  ];
  const collected = {
    events,
    state: {
      ...state,
      last_checked_at: now,
      cursor: { since: now, head_sha: null },
    },
    repository: {
      id: `gh_${source.provider_repo_id}`,
      project_id: project.id,
      provider_repo_id: source.provider_repo_id!,
      owner: "x",
      name: "y",
      canonical_url: "https://github.com/x/y",
      default_branch: "main",
      head_sha: null,
      archived: false,
      parent_id: null,
    },
    readme: {
      sha: "r1",
      text: "## Status\n- Shows the intro video\n## Roadmap\n- Fully playable",
    },
  };
  const prepared = await prepareCollection(store, project, collected, now);
  expect(prepared.extras.commitDaily).toEqual({ "2026-11-24": 31 });
  expect(prepared.result.events.map((e) => e.event_type).sort()).toEqual([
    "commit",
    "readme",
    "release",
  ]);
  await persistCollection(store, state, prepared.result, prepared.extras);
  const progress = await readProgress(store, project.id);
  expect(Object.keys(progress.steps).sort()).toEqual(["P2", "P3", "P4", "P5"]);
  await runCycle(
    store,
    c,
    new GitHubClient(undefined, c.budgets),
    "2026-11-24T12:10:00.000Z",
  );
  const { currentPublication } = await import("../scripts/pipeline");
  const view = (await currentPublication(store))!.data.projects.find(
    (p) => p.id === project.id,
  )!;
  expect(view.progress.level).toBe(5);
  expect(view.activity_daily.at(-1)).toBe(31);
  store.close();
});
it("lo anunciado al empezar es punto de partida; lo posterior es novedad", async () => {
  const store = new LocalStore();
  store.migrate();
  const c = {
    ...config,
    discovery: { ...config.discovery, enabled: false },
    features: { ...config.features, github_enabled: false },
  };
  await runCycle(store, c, new GitHubClient(undefined, c.budgets), now);
  const state =
    (await readEntities<SourceState>(store, "source_state")).find(
      (s) => s.source_id === source.id,
    ) ?? initialState(source.id);
  const next = { ...state, last_checked_at: now };
  const repository = {
    id: `gh_${source.provider_repo_id}`,
    project_id: project.id,
    provider_repo_id: source.provider_repo_id!,
    owner: "x",
    name: "y",
    canonical_url: "https://github.com/x/y",
    default_branch: "main",
    head_sha: null,
    archived: false,
    parent_id: null,
  };
  const first = await prepareCollection(
    store,
    project,
    {
      events: [],
      state: next,
      repository,
      readme: { sha: "r1", text: "Early development. Nothing works yet." },
    },
    now,
  );
  await persistCollection(store, state, first.result, first.extras);
  const read = await readProgress(store, project.id);
  expect(read.first_read_at).toBe(now);
  expect(Object.keys(read.steps)).toEqual([]);
  const later = "2026-11-25T12:00:00.000Z";
  const second = await prepareCollection(
    store,
    project,
    {
      events: [
        event(200, "commit", { message: "Now reaches the title screen", url: null }, later),
      ],
      state: { ...next, last_checked_at: later },
      repository,
      readme: null,
    },
    later,
  );
  await persistCollection(store, next, second.result, second.extras);
  const after = await readProgress(store, project.id);
  expect(after.steps.P5).toBeDefined();
  expect(after.steps.P5?.baseline).toBeUndefined();
  store.close();
});
it("el Radar se ejecuta antes que las fuentes y no se queda sin presupuesto", async () => {
  const store = new LocalStore();
  store.migrate();
  const { CollectionError } = await import("@vi/collectors");
  const calls: string[] = [];
  const client = {
    requests: 0,
    async discover() {
      calls.push("discover");
      return [];
    },
    async collect() {
      calls.push("collect");
      throw new CollectionError("budget_exhausted");
    },
  } as unknown as GitHubClient;
  await runCycle(store, config, client, now);
  expect(calls[0]).toBe("discover");
  const row = (
    await store.query<{ value_json: string }>(
      "SELECT value_json FROM pipeline_state WHERE key='discovery'",
    )
  )[0];
  expect(JSON.parse(row.value_json).last_success_at).toBe(now);
});
it("un candidato de seguimiento automático no rompe la clave ajena y entra en el siguiente ciclo", async () => {
  const store = new LocalStore();
  store.migrate();
  const { demoPublication } = await import("./fixtures/demo");
  const base = demoPublication(config.rubric).data.candidates[0];
  const found = {
    ...base,
    id: "candidate_gh_999000111",
    provider_repo_id: "999000111",
    name: "someone/VIctory-V2",
    canonical_url: "https://github.com/someone/VIctory-V2",
    description: "Community-merged fork of VIctory",
    status: "pending_review" as const,
    linked_project_id: null,
    repo: { stars: 100, size_kb: 5000, language: "Rust", fork: false, pushed_at: null },
  };
  const client = {
    requests: 0,
    discover: async () => [found],
    collect: async () => {
      throw new (await import("@vi/collectors")).CollectionError("budget_exhausted");
    },
  } as unknown as GitHubClient;
  const c = { ...config, sources: config.sources.map((s) => ({ ...s, enabled: false })) };
  const first = await runCycle(store, c, client, now);
  expect(first.run.error_summary).toBeNull();
  const later = new Date(Date.parse(now) + 31 * 60000).toISOString();
  const second = await runCycle(store, c, client, later);
  expect(
    second.publication.data.projects.some((p) => p.id === "project_auto_999000111"),
  ).toBe(true);
});
