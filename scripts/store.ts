import { D1RestStore, LocalStore, type SqlStore } from "@vi/storage";
import { readJson } from "./config";
export function openStore(
  remote = process.argv.includes("--remote"),
): SqlStore {
  if (remote) {
    const d = readJson("config/deployment.json") as Record<string, unknown>;
    if (
      !d.account_free_verified ||
      !d.public_repository_verified ||
      !d.no_overage_verified ||
      !d.verified_at ||
      !d.verified_by
    )
      throw new Error(
        "Despliegue gratuito aún no verificado. Consulta docs/operations.md",
      );
    const {
      CLOUDFLARE_ACCOUNT_ID: account,
      CLOUDFLARE_DATABASE_ID: database,
      CLOUDFLARE_API_TOKEN: token,
    } = process.env;
    if (!account || !database || !token)
      throw new Error("Faltan credenciales de infraestructura D1");
    if (account !== d.cloudflare_account_id || database !== d.d1_database_id)
      throw new Error("Los recursos no coinciden con la revisión de coste");
    return new D1RestStore(account, database, token);
  }
  const local = new LocalStore(".local/vi-race.sqlite");
  local.migrate();
  return local;
}
