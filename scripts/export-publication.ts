import { mkdirSync, writeFileSync } from "node:fs";
import { openStore } from "./store";
import { loadConfig } from "./config";
import {
  currentPublication,
  publicationResources,
  validatePublication,
} from "./pipeline";
import { checksum } from "@vi/storage";
import { demoPublication } from "../tests/fixtures/demo";
import type { Publication } from "@vi/contracts";
const store = openStore(),
  config = loadConfig();
try {
  const publication =
    (await currentPublication(store)) ??
    ({
      schema_version: "1",
      publication_id: "pub_not_initialized",
      generated_at: new Date().toISOString(),
      last_collection_success_at: null,
      mode: "static",
      data: {
        projects: [],
        candidates: [],
        sources: [],
        rubric: config.rubric,
        events: [],
        runs: [],
        discovery_last_success_at: null,
        health: "unknown",
      },
      warnings: [
        "Seguimiento todavía no inicializado. No hay proyectos reales admitidos ni comprobaciones de fuentes registradas.",
      ],
    } satisfies Publication);
  validatePublication(publication, config);
  const out = "apps/web/public/fallback";
  mkdirSync(out, { recursive: true });
  const resources = publicationResources(publication);
  for (const [key, body] of Object.entries(resources)) {
    const path = `${out}/${publication.publication_id}/${key}.json`;
    mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    writeFileSync(path, body);
  }
  writeFileSync(`${out}/latest.json`, JSON.stringify(publication));
  writeFileSync(
    `${out}/manifest.json`,
    JSON.stringify({
      schema_version: "1",
      publication_id: publication.publication_id,
      generated_at: publication.generated_at,
      resources: Object.entries(resources).map(([key, body]) => ({
        key,
        sha256: checksum(body),
      })),
    }),
  );
  // Demostración optativa y separada. Nunca se exporta como latest ni se escribe en D1.
  mkdirSync("apps/web/public/demo", { recursive: true });
  writeFileSync(
    "apps/web/public/demo/publication.json",
    JSON.stringify(demoPublication(config.rubric)),
  );
  console.log(
    `Respaldo estático: ${publication.publication_id}; ${publication.data.projects.length} proyectos reales. Demostración separada.`,
  );
} finally {
  store.close();
}
