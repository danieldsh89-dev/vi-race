import { it, expect } from "vitest";
import { LocalStore, exportBackup, checksum } from "@vi/storage";
import { bootstrapSql, bootstrapQueries } from "../scripts/bootstrap-sql";
import { fixtureProject } from "./fixtures/demo";
it("exporta texto con comillas y se importa en un destino vacío sin alterar su contenido", async () => {
  const source = new LocalStore(),
    destination = new LocalStore();
  try {
    source.migrate();
    destination.migrate();
    const text = JSON.stringify({
      description: "Texto con 'comillas'; no es SQL",
    });
    await source.batch([
      {
        sql: "INSERT INTO pipeline_state(key,value_json) VALUES (?,?)",
        params: ["example", text],
      },
    ]);
    const backup = await exportBackup(source, "2026-11-24T00:00:00Z");
    destination.db.exec(bootstrapSql(backup));
    expect(
      (await exportBackup(destination, backup.generated_at)).checksum,
    ).toBe(backup.checksum);
    expect(() => destination.db.exec(bootstrapSql(backup))).toThrow();
  } finally {
    source.close();
    destination.close();
  }
});
it("restaura el lote sin cortar textos con punto y coma y rechaza un destino ocupado sin cambios", async () => {
  const source = new LocalStore(),
    destination = new LocalStore();
  try {
    source.migrate();
    destination.migrate();
    await source.batch([
      {
        sql: "INSERT INTO pipeline_state(key,value_json) VALUES (?,?)",
        params: ["source", JSON.stringify({ text: "uno; 'dos'; tres" })],
      },
    ]);
    const backup = await exportBackup(source, "2026-11-24T00:00:00Z");
    const statements = bootstrapQueries(backup).map((sql) => ({ sql }));
    await destination.batch(statements);
    expect(
      (await exportBackup(destination, backup.generated_at)).checksum,
    ).toBe(backup.checksum);
    await expect(destination.batch(statements)).rejects.toThrow();
    expect(
      (await exportBackup(destination, backup.generated_at)).checksum,
    ).toBe(backup.checksum);
  } finally {
    source.close();
    destination.close();
  }
});
it("rechaza contenido sintético antes de generar SQL", async () => {
  const source = new LocalStore();
  try {
    source.migrate();
    const backup = await exportBackup(source, "2026-11-24T00:00:00Z");
    backup.tables.projects = [
      { payload_json: JSON.stringify(fixtureProject()) },
    ];
    backup.checksum = checksum(backup.tables);
    expect(() => bootstrapSql(backup)).toThrow("sintética");
  } finally {
    source.close();
  }
});
it("rechaza una publicación anterior de demostración aunque no sea el puntero actual", async () => {
  const db = new LocalStore();
  try {
    db.migrate();
    const backup = await exportBackup(db, "2026-11-24T00:00:00Z");
    backup.tables.publication_blobs = [
      {
        publication_id: "pub_previous",
        resource_key: "latest",
        body_json: JSON.stringify({ mode: "demo", data: {} }),
        body_hash: "a".repeat(64),
        generated_at: backup.generated_at,
      },
    ];
    backup.checksum = checksum(backup.tables);
    expect(() => bootstrapSql(backup)).toThrow("sintética");
  } finally {
    db.close();
  }
});
