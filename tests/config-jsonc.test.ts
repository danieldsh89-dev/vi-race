import { it, expect } from "vitest";
import { parseJsonc, readJsonc } from "../scripts/config";
it("lee comentarios y comas finales sin alterar URLs", () =>
  expect(
    parseJsonc(
      '{ // comentario\n "url":"https://example.com/path", "enabled":true, }',
    ),
  ).toEqual({ url: "https://example.com/path", enabled: true }));
it("rechaza errores de sintaxis aunque el parser pueda recuperar parte del objeto", () =>
  expect(() => parseJsonc('{"enabled": tru,}')).toThrow("JSONC inválida"));
it("lee la configuración real de Wrangler como JSONC", () =>
  expect(readJsonc("apps/api/wrangler.jsonc")).toMatchObject({
    name: "vi-race-api",
    d1_databases: [{ database_name: "vi-race" }],
  }));
