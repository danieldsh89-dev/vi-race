import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
// Solo Actions, contenido público, sin credenciales en argumentos ni en el respaldo.
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.VI_RACE_PUBLIC_BACKUP !== "true"
)
  throw new Error(
    "Publicación de respaldo no habilitada tras revisión de campos públicos",
  );
const git = (args, input) => {
  const r = spawnSync("git", args, { encoding: "utf8", input });
  if (r.status !== 0) throw new Error(`Git falló durante ${args[0]}`);
  return r.stdout.trim();
};
const files = readdirSync(".local/backups")
  .filter((n) => /^(daily|weekly)-\d{4}-\d{2}-\d{2}\.json$/.test(n))
  .sort();
if (!files.length) throw new Error("No hay respaldos verificados");
if (
  files.reduce((sum, n) => sum + statSync(`.local/backups/${n}`).size, 0) >
  100000000
)
  throw new Error("Presupuesto de respaldo agotado");
const entries = [];
for (const name of files) {
  const content = readFileSync(`.local/backups/${name}`, "utf8");
  const parsed = JSON.parse(content);
  if (
    parsed.schema_version !== "1" ||
    !parsed.checksum ||
    /gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:ant-)?[A-Za-z0-9_-]{25,}|-----BEGIN .*PRIVATE KEY-----/.test(
      content,
    )
  )
    throw new Error("Contenido no publicable en respaldo");
  const sha = git(["hash-object", "-w", "--stdin"], content);
  entries.push(`100644 blob ${sha}\t${name}`);
}
const tree = git(["mktree"], entries.join("\n") + "\n");
const probe = spawnSync("git", ["ls-remote", "--heads", "origin", "backups"], {
  encoding: "utf8",
});
if (probe.status !== 0)
  throw new Error("No se ha podido comprobar la rama de respaldo");
let parent = null;
if (probe.stdout.trim()) {
  git(["fetch", "--no-tags", "origin", "backups"]);
  parent = git(["rev-parse", "FETCH_HEAD"]);
  if (git(["rev-parse", `${parent}^{tree}`]) === tree) {
    console.log("Respaldo sin cambios.");
    process.exit(0);
  }
}
const history = git(["count-objects", "-v"]);
const disk =
  Number(history.match(/^size-pack: (\d+)$/m)?.[1] ?? 0) +
  Number(history.match(/^size: (\d+)$/m)?.[1] ?? 0);
if (disk * 1024 > 100000000)
  throw new Error(
    "Historial Git alcanza el presupuesto; compactar con copia verificada antes de sustituir la rama",
  );
const commit = git([
  "-c",
  "user.name=VI Race Backup",
  "-c",
  "user.email=vi-race-backup@users.noreply.github.com",
  "commit-tree",
  tree,
  ...(parent ? ["-p", parent] : []),
  "-m",
  "Respaldo normalizado verificado de VI Race",
]);
git(["push", "origin", `${commit}:refs/heads/backups`]);
console.log("Rama de respaldo actualizada sin force push.");
