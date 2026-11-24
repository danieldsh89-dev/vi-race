import { randomUUID } from "node:crypto";
import {
  D1RestStore,
  LocalStore,
  checksum,
  exportBackup,
  restoreBackup,
  type SqlStore,
} from "@vi/storage";
import { readJson } from "./config";
import { openStore } from "./store";
import { currentPublication } from "./pipeline";
import { bootstrapQueries } from "./bootstrap-sql";

const deployment = readJson("config/deployment.json") as Record<
  string,
  unknown
>;
const targetId = deployment.restore_check_database_id;
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  typeof targetId !== "string" ||
  targetId === deployment.d1_database_id ||
  targetId === process.env.CLOUDFLARE_DATABASE_ID ||
  targetId !== process.env.VI_RACE_RESTORE_DATABASE_ID
)
  throw new Error(
    "La restauración solo admite la base de comprobación registrada en Actions",
  );
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error("Faltan credenciales D1");
const source = openStore(true);
let guardConstraintObserved = false;
const target = new D1RestStore(
  account,
  targetId,
  token,
  async (input, init) => {
    const response = await fetch(input, init);
    // Solo esta sonda inspecciona el error SQL. No imprime la respuesta ni credenciales.
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { success?: unknown } | null;
    if (
      body &&
      (body.success === false || !response.ok) &&
      /CHECK constraint failed:\s*ok\s*=\s*1\b/i.test(JSON.stringify(body))
    )
      guardConstraintObserved = true;
    return response;
  },
);
const local = new LocalStore();

// Clave aleatoria propia: nunca modifica entidades ni el puntero publicado.
async function verifyRollback(store: SqlStore): Promise<void> {
  const key = `restore_probe_${randomUUID()}`;
  try {
    await store.batch([
      {
        sql: "INSERT INTO pipeline_state(key,value_json) VALUES (?,?)",
        params: [key, '{"phase":"before"}'],
      },
    ]);
    const before = await store.query<{ value_json: string }>(
      "SELECT value_json FROM pipeline_state WHERE key=?",
      [key],
    );
    if (before[0]?.value_json !== '{"phase":"before"}')
      throw new Error("D1 no confirmó la escritura de control");
    let rejected = false;
    guardConstraintObserved = false;
    try {
      await store.batch([
        {
          sql: "UPDATE pipeline_state SET value_json=? WHERE key=?",
          params: ['{"phase":"after"}', key],
        },
        { sql: "INSERT INTO write_guards(id,ok) VALUES (?,0)", params: [key] },
      ]);
    } catch (error) {
      if (!guardConstraintObserved) throw error;
      rejected = true;
    }
    const after = await store.query<{ value_json: string }>(
      "SELECT value_json FROM pipeline_state WHERE key=?",
      [key],
    );
    if (!rejected || after[0]?.value_json !== before[0].value_json)
      throw new Error("D1 no deshizo íntegramente el lote fallido");
  } finally {
    await store.batch([
      { sql: "DELETE FROM pipeline_state WHERE key=?", params: [key] },
      { sql: "DELETE FROM write_guards WHERE id=?", params: [key] },
    ]);
  }
}

try {
  await verifyRollback(target);
  const backup = await exportBackup(source, new Date().toISOString());
  if (Buffer.byteLength(JSON.stringify(backup)) > 25000000)
    throw new Error("Respaldo supera el presupuesto de comprobación");
  local.migrate();
  await restoreBackup(local, backup);
  const expected = await currentPublication(local);
  if (!expected)
    throw new Error("El respaldo no contiene una publicación actual");
  // La guarda del primer statement rechaza destinos con datos. Nunca sobrescribir.
  await target.batch(bootstrapQueries(backup).map((sql) => ({ sql })));
  const copy = await exportBackup(target, backup.generated_at);
  const foreignKeys = await target.query("PRAGMA foreign_key_check");
  if (
    copy.checksum !== backup.checksum ||
    foreignKeys.length ||
    checksum(await currentPublication(target)) !== checksum(expected)
  )
    throw new Error("La restauración remota no coincide con el respaldo");
  console.log(
    JSON.stringify({
      rollback: "verified",
      restore: "verified",
      database_id: targetId,
      checksum: copy.checksum,
      publication_id: expected.publication_id,
      foreign_key_errors: foreignKeys.length,
    }),
  );
} finally {
  source.close();
  target.close();
  local.close();
}
