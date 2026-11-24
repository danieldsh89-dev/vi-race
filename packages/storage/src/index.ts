import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}
export const checksum = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
export interface Statement {
  sql: string;
  params?: SQLInputValue[];
}
export interface SqlStore {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: SQLInputValue[],
  ): Promise<T[]>;
  batch(statements: Statement[]): Promise<void>;
  close(): void;
}
export class LocalStore implements SqlStore {
  db: DatabaseSync;
  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  }
  async query<T>(sql: string, params: SQLInputValue[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }
  async batch(statements: Statement[]): Promise<void> {
    this.batchChecked(statements);
  }
  batchChecked(statements: Statement[], check?: () => void): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const s of statements)
        this.db.prepare(s.sql).run(...(s.params ?? []));
      check?.();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  migrate(dir = "migrations") {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)",
    );
    for (const name of readdirSync(dir)
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      if (
        this.db
          .prepare("SELECT name FROM schema_migrations WHERE name=?")
          .get(name)
      )
        continue;
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(readFileSync(`${dir}/${name}`, "utf8"));
        this.db
          .prepare("INSERT INTO schema_migrations VALUES (?,?)")
          .run(name, new Date().toISOString());
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    }
  }
  close() {
    this.db.close();
  }
}
export class D1RestStore implements SqlStore {
  rows_read = 0;
  rows_written = 0;
  size_after = 0;
  constructor(
    private account: string,
    private database: string,
    private token: string,
    private fetcher: typeof fetch = fetch,
  ) {
    if (!/^[a-f0-9]{32}$/.test(account) || !/^[a-f0-9-]{36}$/.test(database))
      throw new Error("IDs D1 inválidos");
  }
  private async send(body: unknown): Promise<
    {
      results: Record<string, unknown>[];
      meta?: { rows_read?: number; rows_written?: number; size_after?: number };
    }[]
  > {
    const res = await this.fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${this.account}/d1/database/${this.database}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!res.ok) throw new Error(`D1 HTTP ${res.status}`);
    const data = (await res.json()) as {
      success: boolean;
      result: {
        success: boolean;
        results: Record<string, unknown>[];
        meta?: {
          rows_read?: number;
          rows_written?: number;
          size_after?: number;
        };
      }[];
    };
    if (!data.success || data.result.some((r) => !r.success))
      throw new Error(
        "D1 rechazó la operación; conservar la publicación anterior",
      );
    for (const r of data.result) {
      this.rows_read += r.meta?.rows_read ?? 0;
      this.rows_written += r.meta?.rows_written ?? 0;
      this.size_after = Math.max(this.size_after, r.meta?.size_after ?? 0);
    }
    return data.result;
  }
  async query<T>(sql: string, params: SQLInputValue[] = []): Promise<T[]> {
    return (await this.send({ sql, params })).flatMap((r) => r.results) as T[];
  }
  async batch(statements: Statement[]): Promise<void> {
    if (statements.length)
      await this.send({
        batch: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })),
      });
  }
  close() {}
}
export function insert(
  table: string,
  fields: Record<string, SQLInputValue>,
  conflict: "ignore" | "update" = "ignore",
): Statement {
  // Todos los identificadores proceden de código, nunca de entradas HTTP.
  if (
    !/^[a-z_]+$/.test(table) ||
    Object.keys(fields).some((k) => !/^[a-z_]+$/.test(k))
  )
    throw new Error("Identificador interno inválido");
  const keys = Object.keys(fields);
  return {
    sql: `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")}) ON CONFLICT DO ${
      conflict === "ignore"
        ? "NOTHING"
        : `UPDATE SET ${keys
            .filter((k) => !["id", "source_id", "key"].includes(k))
            .map((k) => `${k}=excluded.${k}`)
            .join(",")}`
    }`,
    params: Object.values(fields),
  };
}
export async function readEntities<T>(
  store: SqlStore,
  table: string,
): Promise<T[]> {
  if (!/^[a-z_]+$/.test(table)) throw new Error("Tabla inválida");
  const rows = await store.query<{ payload_json: string }>(
    `SELECT payload_json FROM ${table} ORDER BY rowid`,
  );
  return rows.map((r) => JSON.parse(r.payload_json) as T);
}
export const backupTables = [
  "projects",
  "repositories",
  "sources",
  "source_state",
  "events",
  "claims",
  "evidence",
  "claim_evidence",
  "rubrics",
  "milestones",
  "assessments",
  "assessment_evidence",
  "score_history",
  "project_relations",
  "discovery_candidates",
  "analysis_jobs",
  "pipeline_runs",
  "usage_daily",
  "publications",
  "publication_blobs",
  "publication_pointer",
  "audit_log",
  "pipeline_state",
  "event_daily",
] as const;
export interface Backup {
  schema_version: "1";
  generated_at: string;
  tables: Record<string, Record<string, unknown>[]>;
  checksum: string;
}
export async function exportBackup(
  store: SqlStore,
  now: string,
): Promise<Backup> {
  const tables: Backup["tables"] = {};
  for (const t of backupTables)
    tables[t] = await store.query(`SELECT * FROM ${t} ORDER BY rowid`);
  return {
    schema_version: "1",
    generated_at: now,
    tables,
    checksum: checksum(tables),
  };
}
export async function restoreBackup(
  store: LocalStore,
  backup: Backup,
): Promise<void> {
  if (
    backup.schema_version !== "1" ||
    checksum(backup.tables) !== backup.checksum ||
    Object.keys(backup.tables).some(
      (t) => !backupTables.includes(t as (typeof backupTables)[number]),
    )
  )
    throw new Error("Respaldo inválido");
  for (const t of backupTables)
    if ((await store.query(`SELECT 1 FROM ${t} LIMIT 1`)).length)
      throw new Error("La restauración requiere una base vacía");
  const statements: Statement[] = [];
  for (const t of backupTables) {
    if (t === "publication_pointer") {
      for (const row of backup.tables.publications ?? [])
        if (row.status === "complete")
          statements.push({
            sql: "UPDATE publications SET status='complete' WHERE id=?",
            params: [row.id as string],
          });
    }
    for (const row of backup.tables[t] ?? [])
      statements.push(
        insert(
          t,
          (t === "publications"
            ? { ...row, status: "building" }
            : row) as Record<string, SQLInputValue>,
        ),
      );
  }
  store.batchChecked(statements, () => {
    if (store.db.prepare("PRAGMA foreign_key_check").all().length)
      throw new Error("Referencias inválidas tras restauración");
    const tables: Backup["tables"] = {};
    for (const t of backupTables)
      tables[t] = store.db
        .prepare(`SELECT * FROM ${t} ORDER BY rowid`)
        .all() as Record<string, unknown>[];
    if (checksum(tables) !== backup.checksum)
      throw new Error("La restauración no coincide con el respaldo");
  });
}
