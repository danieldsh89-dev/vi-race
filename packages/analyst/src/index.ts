import { z } from "zod";
const ProposalSchema = z
  .object({
    schema_version: z.literal("1"),
    event_ids: z.array(z.string()),
    summary: z.string().max(4000),
    claims: z
      .array(
        z
          .object({
            text: z.string().max(1000),
            evidence_ids: z.array(z.string()),
            milestone_ids: z.array(z.string()),
            recommended_state: z.enum(["claimed", "in_review", "disputed"]),
            limitations: z.array(z.string()),
          })
          .strict(),
      )
      .max(20),
    contradictions: z.array(z.string()).max(20),
    needs_human_review: z.literal(true),
  })
  .strict();
export function validateProposal(
  input: unknown,
  allowed: {
    event_ids: string[];
    evidence_ids: string[];
    milestone_ids: string[];
  },
) {
  const p = ProposalSchema.parse(input);
  if (
    p.event_ids.some((id) => !allowed.event_ids.includes(id)) ||
    p.claims.some(
      (c) =>
        c.evidence_ids.some((id) => !allowed.evidence_ids.includes(id)) ||
        c.milestone_ids.some((id) => !allowed.milestone_ids.includes(id)),
    )
  )
    throw new Error("Referencia de propuesta inventada");
  return p;
}
export function deterministicSummary(eventType: string): string {
  return `Se ha observado actividad de tipo ${eventType}. No confirma una capacidad técnica; requiere revisión de evidencia.`;
}
