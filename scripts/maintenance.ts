import {
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import {
  checksum,
  exportBackup,
  restoreBackup,
  LocalStore,
  type Statement,
} from "@vi/storage";
import { currentPublication } from "./pipeline";
import { openStore } from "./store";
import {applyRetention} from './retention';
const store = openStore();
try {
  const now = new Date(),
    backup = await exportBackup(store, now.toISOString());
  const bytes = Buffer.byteLength(JSON.stringify(backup));
  if (bytes > 25000000)
    throw new Error(
      "Respaldo demasiado grande: requiere exportación por bloques antes de continuar",
    );
  const restored = new LocalStore();
  try {
    restored.migrate();
    await restoreBackup(restored, backup);
    const original = await currentPublication(store),
      copy = await currentPublication(restored);
    if (checksum(original) !== checksum(copy))
      throw new Error("La restauración no coincide");
  } finally {
    restored.close();
  }
  const folder = ".local/backups";
  mkdirSync(folder, { recursive: true });
  const day = now.toISOString().slice(0, 10);
  writeFileSync(`${folder}/daily-${day}.json`, JSON.stringify(backup));
  if (now.getUTCDay() === 0)
    writeFileSync(`${folder}/weekly-${day}.json`, JSON.stringify(backup));
  for (const [kind, keep] of [
    ["daily-", 7],
    ["weekly-", 4],
  ] as const) {
    const files = readdirSync(folder)
      .filter((n) => n.startsWith(kind) && n.endsWith(".json"))
      .sort()
      .reverse();
    for (const name of files.slice(keep)) unlinkSync(`${folder}/${name}`);
  }
  const size = readdirSync(folder)
    .filter((n) => n.endsWith(".json"))
    .reduce((s, n) => s + statSync(`${folder}/${n}`).size, 0);
  if (size > 100000000)
    throw new Error(
      "Presupuesto de respaldo excedido; no ampliar almacenamiento",
    );
  const threshold = new Date(now.getTime() - 86400000).toISOString();
  const obsolete = await store.query<{ id: string }>(
    "SELECT id FROM publications WHERE generated_at<? AND id NOT IN (SELECT id FROM publications WHERE status='complete' ORDER BY generated_at DESC LIMIT 2) AND id NOT IN (SELECT publication_id FROM publication_pointer)",
    [threshold],
  );
  const statements: Statement[] = [];
  for (const p of obsolete)
    statements.push(
      {
        sql: "DELETE FROM publication_blobs WHERE publication_id=?",
        params: [p.id],
      },
      { sql: "DELETE FROM publications WHERE id=?", params: [p.id] },
    );
  await store.batch(statements);
  await applyRetention(store,now.toISOString());
  console.log(
    `Respaldo normalizado verificado por restauración local: ${bytes} bytes. ${obsolete.length} publicaciones antiguas retiradas. No se han eliminado identidades, evaluaciones ni evidencias.`,
  );
} finally {
  store.close();
}
