import { describe, expect, it } from "vitest";
import { handleSync } from "./sync";
import { sqliteD1 } from "./testing/sqliteD1";

function post(body: unknown) {
  return new Request("https://potterycoach.example/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const piece = (id: string, updatedAtMs: number, extra: Record<string, unknown> = {}) => ({
  id,
  updatedAtMs,
  finalHeightMm: 120,
  ...extra,
});

describe("handleSync", () => {
  it("stores a potter's rows and returns what changed since their last sync", async () => {
    const db = sqliteD1();
    let clock = 1_000;
    const deps = { db, userId: "anthony@example.com", now: () => clock };
    const first = await handleSync(
      post({ since: 0, pieces: [piece("p1", 10)], notes: [{ id: "n1", updatedAtMs: 5 }] }),
      deps,
    );
    expect(await first.json()).toMatchObject({ serverTime: 1_000, pieces: [{ id: "p1" }], notes: [{ id: "n1" }] });

    clock = 2_000;
    const later = await (await handleSync(post({ since: 1_001, pieces: [], notes: [] }), deps)).json();
    expect(later).toMatchObject({ pieces: [], notes: [] });
  });

  it("keeps the newer copy of a row", async () => {
    const db = sqliteD1();
    const deps = { db, userId: "u", now: () => 1 };
    await handleSync(post({ since: 0, pieces: [piece("p1", 20, { finalHeightMm: 150 })], notes: [] }), deps);
    const response = await handleSync(
      post({ since: 0, pieces: [piece("p1", 10, { finalHeightMm: 99 })], notes: [] }),
      deps,
    );
    expect(((await response.json()) as { pieces: unknown[] }).pieces).toEqual([
      piece("p1", 20, { finalHeightMm: 150 }),
    ]);
  });

  it("never shows one potter's rows to another", async () => {
    const db = sqliteD1();
    await handleSync(post({ since: 0, pieces: [piece("p1", 1)], notes: [] }), { db, userId: "a", now: () => 1 });
    const other = await handleSync(post({ since: 0, pieces: [], notes: [] }), { db, userId: "b", now: () => 2 });
    expect(((await other.json()) as { pieces: unknown[] }).pieces).toEqual([]);
  });

  it("rejects malformed requests", async () => {
    const deps = { db: sqliteD1(), userId: "u", now: () => 1 };
    expect((await handleSync(post({ since: -1, pieces: [], notes: [] }), deps)).status).toBe(400);
    expect((await handleSync(post({ since: 0, pieces: [{ updatedAtMs: 1 }], notes: [] }), deps)).status).toBe(400);
    expect((await handleSync(new Request("https://x.example/api/sync"), deps)).status).toBe(405);
  });
});
