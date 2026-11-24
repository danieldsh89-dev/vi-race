import { loadConfig } from "./config";
import { openStore } from "./store";
import { runCycle } from "./pipeline";
import { GitHubClient } from "@vi/collectors";
const config = loadConfig(),
  store = openStore();
try {
  const result = await runCycle(
    store,
    config,
    new GitHubClient(process.env.GITHUB_TOKEN, config.budgets),
    new Date().toISOString(),
    process.env.GITHUB_SHA ?? "0000000000000000000000000000000000000000",
  );
  console.log(
    JSON.stringify({
      run: result.run,
      publication_id: result.publication.publication_id,
    }),
  );
  if (result.run.status !== "success") process.exitCode = 1;
} finally {
  store.close();
}
