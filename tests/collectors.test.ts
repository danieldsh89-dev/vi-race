import { it, expect, vi } from "vitest";
import { GitHubClient, CollectionError } from "@vi/collectors";
import { loadConfig } from "../scripts/config";
import { initialState } from "../scripts/pipeline";
import type { Source } from "@vi/contracts";
const budgets = loadConfig().budgets,
  now = "2026-11-24T12:00:00.000Z";
export const repo = {
  id: 42,
  name: "runtime",
  full_name: "test/runtime",
  html_url: "https://github.com/test/runtime",
  description: "GTA VI research",
  default_branch: "main",
  archived: false,
  owner: { login: "test" },
};
const response = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(status === 304 ? null : JSON.stringify(data), {
    status,
    headers,
  });
const source: Source = {
  id: "test_source",
  project_id: null,
  adapter: "github",
  repository: "test/runtime",
  provider_repo_id: "42",
  enabled: true,
  priority: "primary",
  interval_minutes: 10,
  canonical_url: repo.html_url,
  terms_url: "https://docs.github.com/en/site-policy",
  access_notes: "Fixture",
};
const fetcher = (responses: Response[]) =>
  vi.fn<typeof fetch>(async () => {
    const r = responses.shift();
    if (!r) throw new Error("Unexpected request");
    return r;
  });
it("recoge 200, paginación y fechas separadas", async () => {
  const commit = (sha: string) => ({
    sha,
    html_url: `${repo.html_url}/commit/${sha}`,
    commit: { message: "change", committer: { date: now } },
  });
  const f = fetcher([
    response(repo, 200, { etag: "repo-tag" }),
    response([commit("a")], 200, {
      link: '<https://api.github.com/repos/test/runtime/commits?page=2>; rel="next"',
    }),
    response([commit("b")]),
    response([]),
  ]);
  const result = await new GitHubClient(undefined, budgets, f).collect(
    source,
    initialState(source.id),
    now,
  );
  expect(result.events).toHaveLength(2);
  expect(result.state.cursor.since).toBe(now);
  expect(result.state.etag).toBe("repo-tag");
  expect(result.repository.provider_repo_id).toBe("42");
});
it("304 no crea avance y confirma frescura tras comprobar subrecursos", async () => {
  const f = fetcher([
    response(null, 304),
    response(repo),
    response([]),
    response([]),
  ]);
  const result = await new GitHubClient(undefined, budgets, f).collect(
    source,
    { ...initialState(source.id), etag: "existing" },
    now,
  );
  expect(result.events).toHaveLength(0);
  expect(result.state.last_success_at).toBe(now);
  expect(new Headers(f.mock.calls[0][1]?.headers).get("If-None-Match")).toBe(
    "existing",
  );
});
it.each([
  [403, "forbidden"],
  [429, "rate_limited"],
  [404, "not_found"],
] as const)("no reintenta %d", async (status, code) => {
  const f = fetcher([response({}, status)]);
  await expect(
    new GitHubClient(undefined, budgets, f).request("/repos/test/runtime"),
  ).rejects.toMatchObject({ code });
  expect(f).toHaveBeenCalledTimes(1);
});
it("respeta Retry-After y cuota agotada", async () => {
  const f = fetcher([
    response({}, 403, { "retry-after": "120", "x-ratelimit-remaining": "0" }),
  ]);
  await expect(
    new GitHubClient(
      undefined,
      budgets,
      f,
      async () => {},
      () => Date.parse(now),
    ).request("/test"),
  ).rejects.toMatchObject({
    code: "rate_limited",
    retry_at: "2026-11-24T12:02:00.000Z",
  });
});
it("reintenta timeout un máximo de dos veces", async () => {
  const f = vi.fn<typeof fetch>(async () => {
    throw new Error("timeout");
  });
  await expect(
    new GitHubClient(undefined, budgets, f, async () => {}).request("/test"),
  ).rejects.toBeInstanceOf(CollectionError);
  expect(f).toHaveBeenCalledTimes(3);
});
it("rechaza payload grande aun sin Content-Length", async () => {
  const f = fetcher([response("x".repeat(2000))]);
  await expect(
    new GitHubClient(
      undefined,
      { ...budgets, max_payload_bytes: 20 },
      f,
    ).request("/test"),
  ).rejects.toMatchObject({ code: "payload_too_large" });
});
it("rechaza paginación o redirecciones a red interna", async () => {
  await expect(
    new GitHubClient(undefined, budgets, fetcher([])).request(
      "http://127.0.0.1/",
    ),
  ).rejects.toMatchObject({ code: "unsafe_url" });
  await expect(
    new GitHubClient(
      undefined,
      budgets,
      fetcher([response({}, 301, { location: "https://evil.example/" })]),
    ).request("/test"),
  ).rejects.toMatchObject({ code: "unsafe_redirect" });
});
it("detiene peticiones al alcanzar el presupuesto", async () => {
  const c = new GitHubClient(
    undefined,
    { ...budgets, requests_per_cycle: 1 },
    fetcher([response([])]),
  );
  await c.request("/test");
  await expect(c.request("/test")).rejects.toMatchObject({
    code: "budget_exhausted",
  });
});
it("mantiene ID tras un renombrado", async () => {
  const renamed = {
    ...repo,
    name: "renamed",
    full_name: "test/renamed",
    html_url: "https://github.com/test/renamed",
  };
  const r = await new GitHubClient(
    undefined,
    budgets,
    fetcher([response(renamed), response([]), response([])]),
  ).collect(source, initialState(source.id), now);
  expect(r.repository.id).toBe("gh_42");
  expect(r.repository.name).toBe("renamed");
});
it("no acepta otro repositorio en la misma ruta", async () => {
  await expect(
    new GitHubClient(
      undefined,
      budgets,
      fetcher([response({ ...repo, id: 99 })]),
    ).collect(source, initialState(source.id), now),
  ).rejects.toMatchObject({ code: "identity_mismatch" });
});
it("los resultados de búsqueda entran pendientes y no puntúan", async () => {
  const f = fetcher([response({ items: [repo], incomplete_results: false })]);
  const candidates = await new GitHubClient(undefined, budgets, f).discover(
    { id: "q", query: "GTA VI" },
    now,
    1,
  );
  expect(candidates[0].status).toBe("pending_review");
  expect(candidates[0].provider_repo_id).toBe("42");
});
