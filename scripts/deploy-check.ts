import { readJson, readJsonc, loadConfig } from "./config";
export function deploymentCheck() {
  loadConfig();
  const d = readJson("config/deployment.json") as Record<string, unknown>;
  const required = [
    "account_free_verified",
    "public_repository_verified",
    "no_overage_verified",
  ];
  if (required.some((k) => d[k] !== true) || !d.verified_at || !d.verified_by)
    throw new Error(
      "Pendiente: verificar planes gratuitos, repositorio público y bloqueo de sobrecostes en config/deployment.json. No se desplegará.",
    );
  if (
    !d.cloudflare_account_id ||
    !d.d1_database_id ||
    !d.pages_project ||
    !d.site_origin
  )
    throw new Error(
      "Faltan recursos propios y origen en config/deployment.json",
    );
  const w = readJsonc("apps/api/wrangler.jsonc") as {
    d1_databases: { database_id: string }[];
    vars: { ALLOWED_ORIGINS: string };
  };
  if (
    w.d1_databases[0].database_id !== d.d1_database_id ||
    !w.vars.ALLOWED_ORIGINS.split(",").includes(String(d.site_origin))
  )
    throw new Error("Recursos y orígenes no coinciden con la revisión");
  console.log(
    "Revisión declarada de despliegue coherente. Su validez depende de la inspección real de la cuenta registrada.",
  );
}
deploymentCheck();
