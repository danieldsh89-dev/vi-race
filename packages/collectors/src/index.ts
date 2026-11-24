import { z } from "zod";
import { createHash } from "node:crypto";
import type {
  Budgets,
  Candidate,
  Observation,
  Repository,
  Source,
  SourceState,
} from "@vi/contracts";
export const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class CollectionError extends Error {
  constructor(
    public code: string,
    public retry_at: string | null = null,
  ) {
    super(code);
  }
}
const RepoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  full_name: z.string(),
  html_url: z.url(),
  description: z.string().nullable(),
  default_branch: z.string(),
  archived: z.boolean(),
  fork: z.boolean().optional(),
  owner: z.object({ login: z.string() }),
  parent: z.object({ id: z.number() }).optional(),
  stargazers_count: z.number().int().nonnegative().optional(),
  size: z.number().int().nonnegative().optional(),
  forks_count: z.number().int().nonnegative().optional(),
  language: z.string().nullable().optional(),
  pushed_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
const ReadmeSchema = z.object({
  sha: z.string(),
  encoding: z.string(),
  content: z.string(),
});
/** Páginas máximas de commits por recogida; el resto solo se pierde del detalle. */
export const COMMIT_PAGES = 5;
/** Ventana inicial de un repositorio nuevo. */
export const BASELINE_DAYS = 7;
const CommitSchema = z.object({
  sha: z.string(),
  html_url: z.url(),
  commit: z.object({
    message: z.string(),
    committer: z.object({ date: z.string() }).nullable(),
  }),
});
const ReleaseSchema = z.object({
  id: z.number(),
  html_url: z.url(),
  tag_name: z.string(),
  name: z.string().nullable(),
  published_at: z.string().nullable(),
  body: z.string().nullable(),
});
export class GitHubClient {
  requests = 0;
  remaining: number | null = null;
  limit: number | null = null;
  constructor(
    private token: string | undefined,
    private budgets: Budgets,
    private fetcher: typeof fetch = fetch,
    private sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
    private now: () => number = Date.now,
  ) {}
  async request(
    path: string,
    conditional: { etag?: string | null; last_modified?: string | null } = {},
  ): Promise<{
    data: unknown;
    etag: string | null;
    last_modified: string | null;
    next: string | null;
    not_modified: boolean;
    poll_seconds: number;
  }> {
    const url = new URL(path, "https://api.github.com");
    if (
      url.protocol !== "https:" ||
      url.hostname !== "api.github.com" ||
      url.port ||
      url.username ||
      url.password
    )
      throw new CollectionError("unsafe_url");
    for (let attempt = 0; attempt < 3; attempt++) {
      if (
        this.requests >= this.budgets.requests_per_cycle ||
        (this.remaining !== null &&
          this.limit !== null &&
          this.remaining <= this.limit * this.budgets.github_reserve_fraction)
      )
        throw new CollectionError("budget_exhausted");
      this.requests++;
      let response: Response;
      try {
        response = await this.fetcher(url, {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "VI-Race/0.1 public-evidence-monitor",
            "X-GitHub-Api-Version": "2022-11-28",
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
            ...(conditional.etag ? { "If-None-Match": conditional.etag } : {}),
            ...(conditional.last_modified
              ? { "If-Modified-Since": conditional.last_modified }
              : {}),
          },
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        if (attempt < 2) {
          await this.sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new CollectionError("timeout");
      }
      if (response.headers.has("x-ratelimit-remaining"))
        this.remaining = Number(response.headers.get("x-ratelimit-remaining"));
      if (response.headers.has("x-ratelimit-limit"))
        this.limit = Number(response.headers.get("x-ratelimit-limit"));
      if (response.status === 403 || response.status === 429) {
        const retry = response.headers.get("retry-after"),
          reset = response.headers.get("x-ratelimit-reset");
        const when = retry
          ? Number.isFinite(Number(retry))
            ? new Date(this.now() + Number(retry) * 1000).toISOString()
            : new Date(retry).toISOString()
          : reset
            ? new Date(Number(reset) * 1000).toISOString()
            : new Date(this.now() + 3600000).toISOString();
        throw new CollectionError(
          response.status === 429 || retry || this.remaining === 0
            ? "rate_limited"
            : "forbidden",
          when,
        );
      }
      if (response.status >= 500 && attempt < 2) {
        await response.body?.cancel();
        await this.sleep(1000 * 2 ** attempt);
        continue;
      }
      if (response.status === 404) throw new CollectionError("not_found");
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.status !== 304
      ) {
        const location = response.headers.get("location");
        if (!location) throw new CollectionError("invalid_redirect");
        const target = new URL(location, url);
        if (target.origin !== url.origin)
          throw new CollectionError("unsafe_redirect");
        return this.request(target.href, conditional);
      }
      if (!response.ok && response.status !== 304)
        throw new CollectionError(`http_${response.status}`);
      let data: unknown = null;
      if (response.status !== 304) {
        if (
          Number(response.headers.get("content-length") ?? 0) >
          this.budgets.max_payload_bytes
        ) {
          await response.body?.cancel();
          throw new CollectionError("payload_too_large");
        }
        const reader = response.body?.getReader();
        let size = 0;
        const chunks: Uint8Array[] = [];
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > this.budgets.max_payload_bytes) {
              await reader.cancel();
              throw new CollectionError("payload_too_large");
            }
            chunks.push(value);
          }
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const c of chunks) {
          bytes.set(c, offset);
          offset += c.length;
        }
        try {
          data = JSON.parse(new TextDecoder().decode(bytes));
        } catch {
          throw new CollectionError("invalid_json");
        }
      }
      const next =
        response.headers.get("link")?.match(/<([^>]+)>; rel="next"/)?.[1] ??
        null;
      return {
        data,
        etag: response.headers.get("etag"),
        last_modified: response.headers.get("last-modified"),
        next,
        not_modified: response.status === 304,
        poll_seconds: Number(response.headers.get("x-poll-interval") ?? 0),
      };
    }
    throw new CollectionError("retry_exhausted");
  }
  async collect(
    source: Source,
    state: SourceState,
    now: string,
  ): Promise<{
    events: Observation[];
    state: SourceState;
    repository: Repository;
    readme: { sha: string; text: string } | null;
  }> {
    const meta = await this.request(`/repos/${source.repository}`, {
      etag: state.etag,
      last_modified: state.last_modified,
    });
    // Un 304 de metadatos no acredita que commits o releases no hayan cambiado.
    const response = meta.not_modified
      ? await this.request(`/repos/${source.repository}`)
      : meta;
    const repo = RepoSchema.parse(response.data);
    if (source.provider_repo_id && String(repo.id) !== source.provider_repo_id)
      throw new CollectionError("identity_mismatch");
    const base = `/repos/${repo.full_name}`;
    const since =
      state.cursor.since ??
      new Date(Date.parse(now) - BASELINE_DAYS * 86400000).toISOString();
    const events: Observation[] = [];
    let head = state.cursor.head_sha;
    for (const kind of ["commits", "releases"] as const) {
      let path: string | null =
        `${base}/${kind}?per_page=100${kind === "commits" ? `&since=${encodeURIComponent(since)}` : ""}`;
      let pages = 0;
      while (path) {
        // Repositorios con miles de commits diarios: se conserva lo más reciente
        // y se avanza el cursor; el recuento diario queda por debajo del real.
        if (++pages > (kind === "commits" ? COMMIT_PAGES : 3)) break;
        const page = await this.request(path);
        const list = z
          .array(kind === "commits" ? CommitSchema : ReleaseSchema)
          .parse(page.data);
        if (kind === "commits" && pages === 1 && list.length)
          head = (list[0] as z.infer<typeof CommitSchema>).sha;
        let older = false;
        for (const item of list) {
          const commit = CommitSchema.safeParse(item);
          const release = ReleaseSchema.safeParse(item);
          const published = commit.success
            ? (commit.data.commit.committer?.date ?? null)
            : release.success
              ? release.data.published_at
              : null;
          if (published && published < since) {
            older = true;
            continue;
          }
          const external = commit.success
            ? `commit:${repo.id}:${commit.data.sha}`
            : `release:${repo.id}:${release.success ? release.data.id : ""}`;
          const payload = commit.success
            ? {
                url: commit.data.html_url,
                sha: commit.data.sha,
                message: commit.data.commit.message.slice(0, 2000),
              }
            : release.success
              ? {
                  url: release.data.html_url,
                  tag: release.data.tag_name,
                  name: release.data.name,
                  summary: release.data.body?.slice(0, 4000),
                }
              : {};
          events.push({
            id: `evt_${hash([source.id, external]).slice(0, 32)}`,
            source_id: source.id,
            project_id: source.project_id,
            external_id: external,
            event_type: kind === "commits" ? "commit" : "release",
            source_published_at: published,
            observed_at: now,
            content_hash: hash(payload),
            payload,
          });
        }
        path = kind === "releases" && older ? null : page.next;
      }
    }
    let readme: { sha: string; text: string } | null = null;
    let readmeEtag = state.readme_etag ?? null;
    try {
      const r = await this.request(`${base}/readme`, { etag: readmeEtag });
      if (!r.not_modified) {
        const parsed = ReadmeSchema.parse(r.data);
        if (parsed.encoding === "base64")
          readme = {
            sha: parsed.sha,
            text: Buffer.from(parsed.content, "base64")
              .toString("utf8")
              .slice(0, 400000),
          };
        readmeEtag = r.etag;
      }
    } catch (e) {
      // Un README ausente o ilegible no invalida la recogida.
      if (
        e instanceof CollectionError &&
        ["rate_limited", "budget_exhausted"].includes(e.code)
      )
        throw e;
    }
    const lastCommit = events.find((e) => e.event_type === "commit");
    return {
      events,
      readme,
      repository: {
        id: `gh_${repo.id}`,
        project_id: source.project_id,
        provider_repo_id: String(repo.id),
        owner: repo.owner.login,
        name: repo.name,
        canonical_url: repo.html_url,
        default_branch: repo.default_branch,
        head_sha: head,
        archived: repo.archived,
        parent_id: repo.parent ? String(repo.parent.id) : null,
        stats: {
          stars: repo.stargazers_count ?? 0,
          forks: repo.forks_count ?? 0,
          language: repo.language ?? null,
          pushed_at: repo.pushed_at ?? null,
          created_at: repo.created_at ?? null,
          last_commit_at:
            lastCommit?.source_published_at ?? state.cursor.since ?? null,
          last_commit_message:
            typeof lastCommit?.payload.message === "string"
              ? lastCommit.payload.message.split("\n")[0].slice(0, 300)
              : null,
        },
      },
      state: {
        ...state,
        cursor: { since: now, head_sha: head },
        readme_etag: readmeEtag,
        etag: response.etag,
        last_modified: response.last_modified,
        next_due_at: new Date(
          Date.parse(now) +
            Math.max(source.interval_minutes * 60, meta.poll_seconds) * 1000,
        ).toISOString(),
        last_checked_at: now,
        last_success_at: now,
        failure_count: 0,
        last_error_code: null,
      },
    };
  }
  async discover(
    query: { id: string; query: string },
    now: string,
    maxPages: number,
  ): Promise<Candidate[]> {
    let path: string | null =
      `/search/repositories?q=${encodeURIComponent(query.query)}&per_page=30&sort=updated`;
    const result: Candidate[] = [];
    let page = 0;
    while (path && page++ < maxPages) {
      const res = await this.request(path);
      const payload = z
        .object({
          items: z.array(RepoSchema),
          incomplete_results: z.boolean().optional(),
        })
        .parse(res.data);
      if (payload.incomplete_results)
        throw new CollectionError("incomplete_search");
      for (const repo of payload.items.slice(
        0,
        this.budgets.max_candidates - result.length,
      ))
        result.push({
          id: `candidate_gh_${repo.id}`,
          provider_repo_id: String(repo.id),
          canonical_url: repo.html_url,
          name: repo.full_name,
          description: repo.description?.slice(0, 2000) ?? "",
          query_id: query.id,
          first_seen_at: now,
          last_seen_at: now,
          status: "pending_review",
          reason:
            "Coincidencia de búsqueda; relevancia y capacidad pendientes de revisión humana.",
          linked_project_id: null,
          review_commit: null,
          repo: {
            stars: repo.stargazers_count ?? 0,
            size_kb: repo.size ?? 0,
            language: repo.language ?? null,
            fork: repo.fork ?? false,
            pushed_at: repo.pushed_at ?? null,
          },
        });
      if (result.length >= this.budgets.max_candidates) break;
      path = res.next;
    }
    return result;
  }
}
