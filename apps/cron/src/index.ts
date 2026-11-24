import { shouldDispatch, type LatestRun } from "./dispatch";
interface Env {
  GH_REPOSITORY: string;
  GH_WORKFLOW: string;
  GH_REF: string;
  /** Token fine-grained solo con Actions: lectura y escritura en este repositorio. */
  GH_DISPATCH_TOKEN?: string;
}
const headers = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "User-Agent": "vi-race-cron",
  "X-GitHub-Api-Version": "2022-11-28",
});
async function tick(env: Env, now: number): Promise<string> {
  if (!env.GH_DISPATCH_TOKEN) return "sin token: no se dispara nada";
  const base = `https://api.github.com/repos/${env.GH_REPOSITORY}/actions/workflows/${env.GH_WORKFLOW}`;
  const list = await fetch(`${base}/runs?per_page=1`, {
    headers: headers(env.GH_DISPATCH_TOKEN),
  });
  if (!list.ok) return `error al consultar ejecuciones: HTTP ${list.status}`;
  const body = (await list.json()) as { workflow_runs?: LatestRun[] };
  const decision = shouldDispatch(body.workflow_runs?.[0] ?? null, now);
  if (!decision.dispatch) return `omitido: ${decision.reason}`;
  const res = await fetch(`${base}/dispatches`, {
    method: "POST",
    headers: headers(env.GH_DISPATCH_TOKEN),
    body: JSON.stringify({ ref: env.GH_REF }),
  });
  return res.status === 204
    ? `disparado: ${decision.reason}`
    : `error al disparar: HTTP ${res.status}`;
}
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      tick(env, event.scheduledTime).then((msg) => console.log(msg)),
    );
  },
} satisfies ExportedHandler<Env>;
