import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
const assets = "dist/web/assets";
let compressed = 0;
for (const name of readdirSync(assets)) {
  if (name.endsWith(".js"))
    compressed += gzipSync(readFileSync(`${assets}/${name}`)).length;
  if (statSync(`${assets}/${name}`).size > 25 * 1024 * 1024)
    throw new Error("Archivo excede el límite de Pages");
}
if (compressed >= 250 * 1024)
  throw new Error("JavaScript excede el presupuesto comprimido");
const pkg = JSON.parse(
  readFileSync("package.json", "utf8").replace(/^\uFEFF/, ""),
);
if (
  Object.keys(pkg.dependencies).some((k) =>
    /openai|anthropic|gemini|stripe/i.test(k),
  )
)
  throw new Error("Dependencia de pago no permitida en la aplicación");
const patterns = [
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /sk-(?:ant-)?[A-Za-z0-9_-]{25,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
function scan(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) scan(path);
    else if (/\.(json|js|html|css)$/.test(name)) {
      const text = readFileSync(path, "utf8");
      if (patterns.some((p) => p.test(text)))
        throw new Error(`Posible secreto en el artefacto ${path}`);
    }
  }
}
scan("dist/web");
console.log(
  `Presupuesto: ${compressed} bytes de JavaScript gzip, inferior a 250 KiB. Sin patrones de secretos en el artefacto web.`,
);
