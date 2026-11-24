import { loadConfig } from "./config";
import { GitHubClient } from "@vi/collectors";
import { LocalStore, insert, readEntities } from "@vi/storage";
import { initialState, persistCollection } from "./pipeline";
import type { Source, SourceState } from "@vi/contracts";
// Comprobación real separada del catálogo: nunca ejecuta contenido del repositorio.
const c = loadConfig(),
  client = new GitHubClient(process.env.GITHUB_TOKEN, c.budgets),
  store = new LocalStore();
store.migrate();
try {
  const metadata = await client.request("/repos/octocat/Hello-World");
  const id = String((metadata.data as { id: number }).id);
  const source: Source = {
    id: "smoke_github",
    project_id: null,
    adapter: "github",
    repository: "octocat/Hello-World",
    provider_repo_id: id,
    enabled: true,
    priority: "primary",
    interval_minutes: 10,
    canonical_url: "https://github.com/octocat/Hello-World",
    terms_url: "https://docs.github.com/en/site-policy",
    access_notes:
      "Prueba de integración pública; no pertenece al catálogo de VI Race.",
  };
  const initial = initialState(source.id);
  await store.batch([
    insert("sources", {
      id: source.id,
      project_id: null,
      adapter: "github",
      enabled: 1,
      priority: "primary",
      canonical_url: source.canonical_url,
      payload_json: JSON.stringify(source),
    }),
    insert("source_state", {
      source_id: source.id,
      next_due_at: initial.next_due_at,
      last_checked_at: null,
      last_success_at: null,
      failure_count: 0,
      last_error_code: null,
      payload_json: JSON.stringify(initial),
    }),
  ]);
  let count = 0;
  for (let cycle = 1; cycle <= 2; cycle++) {
    const previous = (
        await readEntities<SourceState>(store, "source_state")
      )[0],
      result = await client.collect(source, previous, new Date().toISOString());
    await persistCollection(store, previous, result);
    const total = (
      await store.query<{ total: number }>(
        "SELECT count(*) AS total FROM events",
      )
    )[0].total;
    if (cycle === 2 && total > count + result.events.length)
      throw new Error("Duplicados inesperados");
    count = total;
    console.log(
      JSON.stringify({
        cycle,
        repository_id: result.repository.provider_repo_id,
        events_received: result.events.length,
        unique_events: count,
        last_success_at: result.state.last_success_at,
        conditional_etag: !!previous.etag,
      }),
    );
  }
  console.log(
    `Integración GitHub correcta: ${client.requests} peticiones, dos lotes persistidos en memoria. No se ha modificado el catálogo.`,
  );
} finally {
  store.close();
}
