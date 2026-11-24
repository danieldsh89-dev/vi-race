import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const probe = spawnSync("git", ["ls-remote", "--heads", "origin", "backups"], {
  encoding: "utf8",
});
if (probe.status !== 0)
  throw new Error("No se ha podido comprobar el respaldo remoto");
mkdirSync(".local/backups", { recursive: true });
if (!probe.stdout.trim()) process.exit(0);
const fetched = spawnSync("git", ["fetch", "--no-tags", "origin", "backups"], {
  encoding: "utf8",
});
if (fetched.status !== 0)
  throw new Error("No se ha podido cargar la rama de respaldo");
const list = spawnSync("git", ["ls-tree", "--name-only", "FETCH_HEAD"], {
  encoding: "utf8",
});
if (list.status !== 0) throw new Error("Rama de respaldo no legible");
for (const name of list.stdout
  .trim()
  .split("\n")
  .filter((n) => /^(daily|weekly)-\d{4}-\d{2}-\d{2}\.json$/.test(n))) {
  const r = spawnSync("git", ["show", `FETCH_HEAD:${name}`], {
    encoding: "utf8",
    maxBuffer: 26000000,
  });
  if (r.status !== 0)
    throw new Error("Respaldo remoto excede el límite o no es legible");
  writeFileSync(`.local/backups/${name}`, r.stdout);
}
