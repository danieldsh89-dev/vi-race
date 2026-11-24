import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readJson } from "./config";
const d = readJson("config/deployment.json") as Record<string, unknown>;
if (
  !d.restore_check_database_id ||
  d.restore_check_database_id === d.d1_database_id ||
  d.restore_check_database_id === process.env.CLOUDFLARE_DATABASE_ID ||
  d.restore_check_database_id !== process.env.VI_RACE_RESTORE_DATABASE_ID
)
  throw new Error("Base de comprobación no registrada");
mkdirSync(".local/deployment", { recursive: true });
writeFileSync(
  ".local/deployment/restore-wrangler.json",
  JSON.stringify({
    name: "vi-race-restore-check",
    compatibility_date: "2026-11-24",
    d1_databases: [
      {
        binding: "DB",
        database_name: "vi-race-restore-check",
        database_id: d.restore_check_database_id,
        migrations_dir: resolve("migrations"),
      },
    ],
  }),
);
