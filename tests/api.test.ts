import { it, expect, vi } from "vitest";
import api from "../apps/api/src/index";
const origin = "http://127.0.0.1:5173";
function env(
  row: { body_json: string; body_hash: string } | null = {
    body_json: '{"schema_version":"1","publication_id":"pub_test"}',
    body_hash: "abc",
  },
) {
  const statement = Object.create(null) as D1PreparedStatement;
  statement.first = vi.fn().mockResolvedValue(row);
  statement.bind = vi.fn(() => statement);
  const db = Object.create(null) as D1Database;
  const prepare = vi.fn(() => statement);
  db.prepare = prepare;
  return {
    env: {
      DB: db,
      ALLOWED_ORIGINS:
        "https://vi-race.pages.dev,http://127.0.0.1:5173,http://localhost:5173",
    } satisfies Env,
    prepare,
  };
}
it("sirve JSON precalculado sin consultar proveedores externos", async () => {
  const e = env(),
    r = await api.fetch(
      new Request("https://api.example/api/v1/latest"),
      e.env,
    );
  expect(r.status).toBe(200);
  expect(r.headers.get("Cache-Control")).toContain("120");
  expect(e.prepare).toHaveBeenCalledTimes(1);
  expect(await r.json()).toHaveProperty("publication_id", "pub_test");
});
it("ETag admite 304", async () => {
  const e = env();
  const r = await api.fetch(
    new Request("https://api.example/api/v1/latest", {
      headers: { "If-None-Match": '"abc"' },
    }),
    e.env,
  );
  expect(r.status).toBe(304);
});
it.each(['W/"abc"', '"other", W/"abc"', "*"])(
  "ETag admite comparación GET débil o lista: %s",
  async (value) => {
    const e = env();
    const r = await api.fetch(
      new Request("https://api.example/api/v1/latest", {
        headers: { "If-None-Match": value },
      }),
      e.env,
    );
    expect(r.status).toBe(304);
  },
);
it("rechaza métodos no admitidos", async () => {
  const e = env();
  expect(
    (
      await api.fetch(
        new Request("https://api.example/api/v1/latest", { method: "POST" }),
        e.env,
      )
    ).status,
  ).toBe(405);
  expect(e.prepare).not.toHaveBeenCalled();
});
it("rechaza parámetros de búsqueda sin consultar D1", async () => {
  const e = env();
  expect(
    (
      await api.fetch(
        new Request("https://api.example/api/v1/latest?url=http://127.0.0.1"),
        e.env,
      )
    ).status,
  ).toBe(400);
  expect(e.prepare).not.toHaveBeenCalled();
});
it("CORS solo permite los orígenes definidos", async () => {
  const e = env();
  const good = await api.fetch(
    new Request("https://api.example/api/v1/latest", { headers: { origin } }),
    e.env,
  );
  expect(good.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(good.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  expect(
    (
      await api.fetch(
        new Request("https://api.example/api/v1/latest", {
          headers: { origin: "https://evil.example" },
        }),
        e.env,
      )
    ).status,
  ).toBe(403);
});
it("preflight no consulta D1", async () => {
  const e = env();
  expect(
    (
      await api.fetch(
        new Request("https://api.example/api/v1/latest", {
          method: "OPTIONS",
          headers: { origin },
        }),
        e.env,
      )
    ).status,
  ).toBe(204);
  expect(e.prepare).not.toHaveBeenCalled();
});
it("versiona fichas y admite histórico por bloques", async () => {
  const e = env();
  for (const path of [
    "projects",
    "projects/p1",
    "projects/p1/history/0",
    "radar",
    "methodology",
  ]) {
    const r = await api.fetch(
      new Request(`https://api.example/api/v1/publications/pub_test/${path}`),
      e.env,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toContain("immutable");
  }
});
it("un recurso antiguo ausente es 404", async () => {
  const e = env(null);
  expect(
    (
      await api.fetch(
        new Request("https://api.example/api/v1/publications/pub_old/projects"),
        e.env,
      )
    ).status,
  ).toBe(404);
  expect(
    (await api.fetch(new Request("https://api.example/api/v1/latest"), e.env))
      .status,
  ).toBe(503);
});
it("no acepta SQL ni rutas arbitrarias", async () => {
  const e = env();
  expect(
    (
      await api.fetch(
        new Request("https://api.example/api/v1/publications/pub_test/query"),
        e.env,
      )
    ).status,
  ).toBe(404);
  expect(e.prepare).not.toHaveBeenCalled();
});
it("limita el cuerpo preparado", async () => {
  const e = env({ body_json: "x".repeat(600001), body_hash: "a" });
  expect(
    (await api.fetch(new Request("https://api.example/api/v1/latest"), e.env))
      .status,
  ).toBe(503);
});
it("los errores de almacenamiento no filtran trazas", async () => {
  const e = env();
  e.prepare.mockImplementation(() => {
    throw new Error("secret database info");
  });
  const r = await api.fetch(
    new Request("https://api.example/api/v1/status"),
    e.env,
  );
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("secret");
});
