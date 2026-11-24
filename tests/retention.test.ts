import { it, expect } from "vitest";
import { LocalStore, insert } from "@vi/storage";
import { applyRetention } from "../scripts/retention";
it("compacta actividad antigua sin borrar eventos que soportan afirmaciones y es idempotente", async () => {
  const db = new LocalStore();
  db.migrate();
  const old = "2026-01-01T00:00:00.000Z";
  try {
    await db.batch([
      insert("projects", {
        id: "p",
        slug: "p",
        name: "p",
        project_type: "research",
        review_status: "accepted",
        ranking_eligible: 0,
        created_at: old,
        updated_at: old,
        payload_json: "{}",
      }),
      insert("sources", {
        id: "s",
        project_id: "p",
        adapter: "github",
        enabled: 1,
        priority: "primary",
        canonical_url: "https://github.com/a/b",
        payload_json: "{}",
      }),
      ...["kept", "compact"].map((id) =>
        insert("events", {
          id,
          source_id: "s",
          project_id: "p",
          external_id: id,
          event_type: "commit",
          observed_at: old,
          source_published_at: old,
          content_hash: "a".repeat(64),
          payload_json: JSON.stringify({
            id,
            payload: { message: "material" },
          }),
        }),
      ),
      insert("claims", {
        id: "claim",
        project_id: "p",
        event_id: "kept",
        statement: "Afirmación con procedencia",
        target_version: "v1",
        status: "claimed",
        created_at: old,
        payload_json: "{}",
      }),
    ]);
    await applyRetention(db, "2026-11-24T00:00:00.000Z");
    await applyRetention(db, "2026-11-24T00:00:00.000Z");
    expect(
      (await db.query<{ id: string }>("SELECT id FROM events")).map(
        (e) => e.id,
      ),
    ).toEqual(["kept"]);
    expect(
      (
        await db.query<{ event_count: number }>(
          "SELECT event_count FROM event_daily",
        )
      )[0].event_count,
    ).toBe(1);
    expect(await db.query("PRAGMA foreign_key_check")).toEqual([]);
  } finally {
    db.close();
  }
});
