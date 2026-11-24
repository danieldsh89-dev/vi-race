import { expect, it } from "vitest";
import { shouldDispatch, MIN_GAP_MS, STALE_MS } from "../apps/cron/src/dispatch";
const now = Date.parse("2026-11-24T17:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
it("el temporizador dispara solo cuando toca", () => {
  expect(shouldDispatch(null, now).dispatch).toBe(true);
  expect(shouldDispatch({ status: "completed", created_at: ago(MIN_GAP_MS + 1) }, now).dispatch).toBe(true);
  expect(shouldDispatch({ status: "completed", created_at: ago(60_000) }, now).dispatch).toBe(false);
  expect(shouldDispatch({ status: "in_progress", created_at: ago(MIN_GAP_MS + 1) }, now).dispatch).toBe(false);
  expect(shouldDispatch({ status: "queued", created_at: ago(STALE_MS + 1) }, now).dispatch).toBe(true);
});
