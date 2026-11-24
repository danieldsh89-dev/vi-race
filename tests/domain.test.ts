import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { Assessment, Rubric } from "@vi/contracts";
import {
  validateRubric,
  calculateScore,
  validateAssessment,
  freshness,
  rankProjects,
} from "@vi/domain";
import {
  fixtureAssessment,
  fixtureEvidence,
  fixtureProject,
} from "./fixtures/demo";
import { checksum } from "@vi/storage";
const rubric = validateRubric(
    JSON.parse(
      readFileSync("config/rubrics/vi-pc-v1.json", "utf8").replace(
        /^\uFEFF/,
        "",
      ),
    ),
  ),
  date = "2026-11-25T00:00:00.000Z";
const score = (assessments: Assessment[]) =>
  calculateScore(fixtureProject(), "fixture-v1", assessments, rubric, date);
describe("Rúbrica y puntuación", () => {
  it("contiene exactamente los 20 hitos y 100 puntos", () =>
    expect(rubric.milestones.reduce((s, m) => s + m.weight, 0)).toBe(100));
  it.each(["duplicate", "weight", "cycle", "missing"] as const)(
    "rechaza rúbrica %s",
    (kind) => {
      const r: Rubric = structuredClone(rubric);
      if (kind === "duplicate") r.milestones[1].id = "M01";
      if (kind === "weight") r.milestones[0].weight = -1;
      if (kind === "cycle") r.milestones[0].dependencies = ["M03"];
      if (kind === "missing") r.milestones[0].dependencies = ["M99"];
      expect(() => validateRubric(r)).toThrow();
    },
  );
  it("no presume fracaso cuando faltan confirmaciones", () => {
    expect(score([]).score).toBe(0);
    expect(score([]).contributions[0].reason).toContain("Sin confirmación");
  });
  it("M01, M02 y M03 suman 11", () =>
    expect(
      score(["M01", "M02", "M03"].map((m) => fixtureAssessment(m))).score,
    ).toBe(11));
  it("todos los hitos confirmados suman 100", () =>
    expect(
      score(rubric.milestones.map((m) => fixtureAssessment(m.id))).score,
    ).toBe(100));
  it("declaraciones no suman", () =>
    expect(
      score([{ ...fixtureAssessment("M01"), state: "claimed" }]).score,
    ).toBe(0));
  it.each(["disputed", "refuted", "regressed"] as const)(
    "suspende dependientes si M01 está %s",
    (state) => {
      const a = rubric.milestones.map((m) => fixtureAssessment(m.id));
      a.push({
        ...fixtureAssessment("M01"),
        id: "correction_fixture_1",
        supersedes_id: a[0].id,
        state,
        effective_at: "2026-11-24T13:00:00.000Z",
        recorded_at: "2026-11-24T13:00:00.000Z",
      });
      expect(score(a).score).toBe(0);
      expect(a[0].state).toBe("confirmed");
    },
  );
  it("no aplica evaluaciones de otra versión o posteriores al corte", () => {
    expect(
      score([{ ...fixtureAssessment("M01"), target_version: "another" }]).score,
    ).toBe(0);
    expect(
      score([
        { ...fixtureAssessment("M01"), recorded_at: "2027-01-01T00:00:00Z" },
      ]).score,
    ).toBe(0);
  });
  it("no normaliza componentes", () =>
    expect(
      calculateScore(
        fixtureProject("component_fixture", "Componente", "component"),
        "fixture-v1",
        rubric.milestones.map((m) =>
          fixtureAssessment(m.id, "component_fixture"),
        ),
        rubric,
        date,
      ).score,
    ).toBe(0));
  it("mantiene determinismo sin depender del orden del objeto", () => {
    expect(score(["M01", "M02"].map((m) => fixtureAssessment(m)))).toEqual(
      score(["M02", "M01"].map((m) => fixtureAssessment(m))),
    );
    expect(checksum({ b: 2, a: 1 })).toBe(checksum({ a: 1, b: 2 }));
  });
  it("los empates comparten posición", () => {
    const result = rankProjects([
      { ...fixtureProject(), score: score([]) },
      { ...fixtureProject("second_fixture", "Otra"), score: score([]) },
    ]);
    expect(result.map((p) => p.rank)).toEqual([1, 1]);
  });
});
describe("Autoridad y procedencia", () => {
  const validate = (
    a: Assessment = fixtureAssessment("M01"),
    ev = fixtureEvidence(),
  ) =>
    validateAssessment(a, ev, fixtureProject(), ["reviewer_fixture"], rubric);
  it("acepta E2 y corroboración independiente E3", () =>
    expect(validate().state).toBe("confirmed"));
  it("rechaza revisor no autorizado", () =>
    expect(() =>
      validate({ ...fixtureAssessment("M01"), reviewer: "robot" }),
    ).toThrow());
  it("rechaza evidencia inexistente", () =>
    expect(() =>
      validate({ ...fixtureAssessment("M01"), evidence_ids: ["nonexistent"] }),
    ).toThrow());
  it("rechaza material de otra versión", () =>
    expect(() =>
      validate(
        fixtureAssessment("M01"),
        fixtureEvidence().map((e) => ({ ...e, target_version: "wrong" })),
      ),
    ).toThrow());
  it("rechaza declaración, IA y falta de E2", () =>
    expect(() =>
      validate(
        fixtureAssessment("M01"),
        fixtureEvidence().map((e) => ({ ...e, level: "E0" })),
      ),
    ).toThrow());
  it("no acepta varios artículos del mismo anuncio como independencia", () =>
    expect(() =>
      validate(
        fixtureAssessment("M01"),
        fixtureEvidence().map((e) => ({ ...e, provenance_chain: "same" })),
      ),
    ).toThrow());
  it("admite comprobación documental independiente descrita por otro revisor autorizado", () => {
    const ev = fixtureEvidence();
    ev[1] = { ...ev[1], level: "E1", author: "Independiente" };
    const a = {
      ...fixtureAssessment("M01"),
      evidence_ids: ev.map((e) => e.id),
      independent_check: {
        reviewer: "Independiente",
        method:
          "Revisión independiente documentada de criterios de arquitectura",
        evidence_ids: [ev[1].id],
      },
    };
    expect(
      validateAssessment(
        a,
        ev,
        fixtureProject(),
        ["reviewer_fixture", "Independiente"],
        rubric,
      ).state,
    ).toBe("confirmed");
  });
  it("no permite que el autor de E2 se corrobore con otra cadena E3", () => {
    const ev = fixtureEvidence();
    ev[1].author = ev[0].author;
    expect(() => validate(fixtureAssessment("M01"), ev)).toThrow(
      "independiente",
    );
  });
  it("no permite autorrevisión manual de la misma demostración", () => {
    const ev = fixtureEvidence().filter((e) => e.level === "E2");
    const a = {
      ...fixtureAssessment("M01"),
      evidence_ids: ev.map((e) => e.id),
      independent_check: {
        reviewer: "Segundo",
        method:
          "Descripción independiente de suficiente longitud para comprobar.",
        evidence_ids: ev.map((e) => e.id),
      },
    };
    expect(() =>
      validateAssessment(
        a,
        ev,
        fixtureProject(),
        ["reviewer_fixture", "Segundo"],
        rubric,
      ),
    ).toThrow("independiente");
  });
  it("calcula antigüedad con los intervalos de cada fuente", () => {
    const now = Date.parse(date);
    expect(freshness(null, 10, now)).toBe("unknown");
    expect(freshness(new Date(now - 29 * 60000).toISOString(), 10, now)).toBe(
      "updated",
    );
    expect(freshness(new Date(now - 35 * 60000).toISOString(), 10, now)).toBe(
      "delayed",
    );
    expect(freshness(new Date(now - 60 * 60000).toISOString(), 10, now)).toBe(
      "stale",
    );
  });
});
