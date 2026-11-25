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
  // Agotar el presupuesto por ciclo es normal con muchos proyectos: el resto
  // se recoge en el siguiente ciclo. Un repositorio borrado (not_found) o
  // recreado con otra identidad (identity_mismatch) queda marcado en su fuente
  // y no debe tumbar el ciclo entero. Solo fallan los errores reales.
  const real = (result.run.error_summary ?? "")
    .split("; ")
    .filter(
      (e) => e && !/:(budget_exhausted|time_budget|not_found|identity_mismatch)$|^time_budget$/.test(e),
    );
  if (result.run.status === "failed" || real.length) process.exitCode = 1;
} finally {
  store.close();
}
