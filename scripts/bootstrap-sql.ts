import { backupTables, checksum, type Backup } from "@vi/storage";
import { ProjectSchema, EvidenceSchema, AssessmentSchema } from "@vi/contracts";
import { assertProductionInputs } from "./config";
function literal(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new Error("Tipo no permitido en exportación SQL");
}
export function bootstrapQueries(backup: Backup): string[] {
  if (
    backup.schema_version !== "1" ||
    checksum(backup.tables) !== backup.checksum ||
    backupTables.some((t) => !Array.isArray(backup.tables[t]))
  )
    throw new Error("Respaldo inválido");
  const checkSynthetic = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(checkSynthetic);
      return;
    }
    const object = value as Record<string, unknown>;
    if (
      object.synthetic === true ||
      object.mode === "demo" ||
      (typeof object.id === "string" && /(?:^|_)fixture_/.test(object.id))
    )
      throw new Error("Entidad sintética en respaldo de producción");
    Object.values(object).forEach(checkSynthetic);
  };
  for (const table of backupTables)
    for (const row of backup.tables[table]) {
      checkSynthetic(row);
      for (const [key, value] of Object.entries(row))
        if (key.endsWith("_json") && typeof value === "string")
          checkSynthetic(JSON.parse(value));
    }
  assertProductionInputs({
    projects: backup.tables.projects.map((r) =>
      ProjectSchema.parse(JSON.parse(String(r.payload_json))),
    ),
    evidence: backup.tables.evidence.map((r) =>
      EvidenceSchema.parse(JSON.parse(String(r.payload_json))),
    ),
    assessments: backup.tables.assessments.map((r) =>
      AssessmentSchema.parse(JSON.parse(String(r.payload_json))),
    ),
  });
  const sql = [
    `INSERT INTO write_guards(id,ok) SELECT 'bootstrap',CASE WHEN ${backupTables.map((t) => `NOT EXISTS(SELECT 1 FROM ${t})`).join(" AND ")} THEN 1 ELSE 0 END;`,
  ];
  for (const table of backupTables.filter((t) => t !== "publication_pointer"))
    for (const original of backup.tables[table]) {
      const row =
        table === "publications"
          ? { ...original, status: "building" }
          : original;
      if (Object.keys(row).some((k) => !/^[a-z_]+$/.test(k)))
        throw new Error("Columna inválida");
      sql.push(
        `INSERT INTO ${table} (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(literal).join(",")});`,
      );
    }
  for (const row of backup.tables.publications)
    if (row.status === "complete")
      sql.push(
        `UPDATE publications SET status='complete' WHERE id=${literal(row.id)};`,
      );
  for (const row of backup.tables.publication_pointer)
    sql.push(
      `INSERT INTO publication_pointer(name,publication_id,updated_at) VALUES (${literal(row.name)},${literal(row.publication_id)},${literal(row.updated_at)});`,
    );
  sql.push("DELETE FROM write_guards WHERE id='bootstrap';");
  return sql;
}
export function bootstrapSql(backup: Backup): string {
  return bootstrapQueries(backup).join("\n");
}
