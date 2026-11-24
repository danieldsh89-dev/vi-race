import type { Publication } from "@vi/contracts";
import { validateRubric } from "@vi/domain";
import { PublicationSchema } from "@vi/contracts/publication";
export function parsePublication(value: unknown, demo = false): Publication {
  if (!value || typeof value !== "object")
    throw new Error("Publicación inválida");
  const p = PublicationSchema.parse(value);
  if (
    p.schema_version !== "1" ||
    !/^pub_[\w-]+$/.test(p.publication_id) ||
    !Number.isFinite(Date.parse(p.generated_at)) ||
    !p.data ||
    !Array.isArray(p.data.projects) ||
    !Array.isArray(p.data.sources) ||
    !Array.isArray(p.data.candidates) ||
    !Array.isArray(p.data.runs) ||
    !Array.isArray(p.warnings) ||
    (!demo && p.mode === "demo")
  )
    throw new Error("Contrato de publicación incompatible");
  validateRubric(p.data.rubric);
  return p;
}
export async function getPublication(
  url: string,
  demo = false,
): Promise<Publication> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    cache: "no-cache",
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 600000) throw new Error("Publicación demasiado grande");
  return parsePublication(JSON.parse(text), demo);
}
