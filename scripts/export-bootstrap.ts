import { mkdirSync, writeFileSync } from "node:fs";
import { LocalStore, exportBackup, restoreBackup } from "@vi/storage";
import { currentPublication, validatePublication } from "./pipeline";
import { loadConfig } from "./config";
import { bootstrapSql } from "./bootstrap-sql";
const source = new LocalStore(".local/vi-race.sqlite"),
  verification = new LocalStore();
try {
  source.migrate();
  verification.migrate();
  const publication = await currentPublication(source);
  if (!publication) throw new Error("No hay publicación local que exportar");
  validatePublication(publication, loadConfig());
  const backup = await exportBackup(source, new Date().toISOString());
  await restoreBackup(verification, backup);
  mkdirSync(".local/deployment", { recursive: true });
  const sql = bootstrapSql(backup);
  writeFileSync(".local/deployment/bootstrap.sql", sql);
  writeFileSync(
    ".local/deployment/bootstrap-manifest.json",
    JSON.stringify({
      publication_id: publication.publication_id,
      backup_checksum: backup.checksum,
      sql_bytes: Buffer.byteLength(sql),
    }),
  );
  console.log(
    `SQL de inicio preparado y restauración verificada: ${Buffer.byteLength(sql)} bytes. Solo admite un destino vacío; no realiza llamadas remotas.`,
  );
} finally {
  source.close();
  verification.close();
}
