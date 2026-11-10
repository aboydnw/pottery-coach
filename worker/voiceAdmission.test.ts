import { expect, it, vi } from "vitest";
import { admitVoiceStart, isVoiceAdmin, VOICE_START_LIMITS, type VoiceAdmissionConfig } from "./voiceAdmission";
import { sqliteD1 } from "./testing/sqliteD1";

const NOW = Date.UTC(2026, 10, 10, 12);
const preview = { mode: "limited-preview" };
const start = (db: D1Database, user = "free@example.test", now = NOW, config: VoiceAdmissionConfig = preview) =>
  admitVoiceStart(db, user, config, now, crypto.randomUUID());

it("keeps non-admin voice closed by default and on unknown configuration", async () => {
  const db = sqliteD1();
  expect((await start(db, undefined, undefined, {}))?.status).toBe(503);
  expect((await start(db, undefined, undefined, { mode: "public" }))?.status).toBe(503);
});

it("uses an exact server allowlist and keeps the emergency stop effective for admins", async () => {
  const config = { mode: "owner-only", adminUserIds: " Owner@Example.Test , other@example.test " };
  expect(isVoiceAdmin("owner@example.test", config)).toBe(true);
  expect(isVoiceAdmin("not-owner@example.test", config)).toBe(false);
  expect(isVoiceAdmin("owner@example.test.attacker.test", config)).toBe(false);
  expect(isVoiceAdmin("dev@localhost", config)).toBe(false);
  const db = { batch: vi.fn().mockRejectedValue(new Error("unavailable")) } as unknown as D1Database;
  for (let count = 0; count < 110; count++) {
    expect(await start(db, "owner@example.test", NOW, config)).toBeNull();
  }
  expect(db.batch).not.toHaveBeenCalled();
  expect((await start(db, "owner@example.test", NOW, { ...config, mode: "off" }))?.status).toBe(503);
  expect((await start(db, "owner@example.test", NOW, { ...config, mode: "typo" }))?.status).toBe(503);
});

it("enforces rolling account frequency despite changed IPs and boundary bursts", async () => {
  const db = sqliteD1();
  expect(await start(db, undefined, NOW + 59_999)).toBeNull();
  expect((await start(db, undefined, NOW + 60_001))?.status).toBe(429);
  expect(await start(db, undefined, NOW + 119_999)).toBeNull();
});

it("enforces free daily and monthly starts and resets by UTC calendar", async () => {
  const db = sqliteD1();
  expect(await start(db)).toBeNull();
  expect(await start(db, undefined, NOW + 60_000)).toBeNull();
  expect((await start(db, undefined, NOW + 120_000))?.status).toBe(429);
  expect(await start(db, undefined, NOW + 86_400_000)).toBeNull();
  expect((await start(db, undefined, NOW + 2 * 86_400_000))?.status).toBe(429);
  expect(await start(db, undefined, Date.UTC(2026, 11, 1))).toBeNull();
});

it("only grants a higher allowance from an unexpired server entitlement", async () => {
  const db = sqliteD1();
  await start(db, "initialize@example.test");
  await db
    .prepare("INSERT INTO voice_entitlements VALUES (?, 'paid', ?)")
    .bind("paid@example.test", NOW + 60_000)
    .run();
  for (let count = 0; count < VOICE_START_LIMITS.paid.minute; count++) {
    expect(await start(db, "paid@example.test")).toBeNull();
  }
  expect((await start(db, "paid@example.test"))?.status).toBe(429);
  // Expiration immediately falls back to the free allowance, retaining earlier usage.
  expect((await start(db, "paid@example.test", NOW + 60_000))?.status).toBe(429);
});

it("uses the paid daily and monthly limits without granting unlimited use", async () => {
  const db = sqliteD1();
  await start(db, "initialize@example.test", Date.UTC(2026, 9, 1));
  await db
    .prepare("INSERT INTO voice_entitlements VALUES (?, 'paid', ?)")
    .bind("paid@example.test", NOW + 31 * 86_400_000)
    .run();
  for (let day = 0; day < 6; day++) {
    for (let count = 0; count < VOICE_START_LIMITS.paid.day; count++) {
      expect(await start(db, "paid@example.test", NOW + day * 86_400_000 + count * 60_000)).toBeNull();
    }
    expect((await start(db, "paid@example.test", NOW + day * 86_400_000 + 11 * 60_000))?.status).toBe(429);
  }
  expect((await start(db, "paid@example.test", NOW + 6 * 86_400_000))?.status).toBe(429);
});

it("caps aggregate preview starts even when a caller uses many different accounts", async () => {
  const db = sqliteD1();
  for (let day = 0; day < 5; day++) {
    for (let count = 0; count < VOICE_START_LIMITS.shared.day; count++) {
      expect(await start(db, `user-${day}-${count}@example.test`, NOW + day * 86_400_000)).toBeNull();
    }
    expect((await start(db, `extra-${day}@example.test`, NOW + day * 86_400_000))?.status).toBe(429);
  }
  expect((await start(db, "new@example.test", NOW + 6 * 86_400_000))?.status).toBe(429);
});

it("atomically admits only the allowed concurrent requests across independent invocations", async () => {
  const db = sqliteD1();
  const results = await Promise.all(Array.from({ length: 30 }, () => start(db)));
  expect(results.filter((response) => response === null)).toHaveLength(1);
  expect(results.filter((response) => response?.status === 429)).toHaveLength(29);
});

it("enforces the shared limit when different accounts race for the last start", async () => {
  const db = sqliteD1();
  for (let count = 0; count < VOICE_START_LIMITS.shared.day - 1; count++) {
    expect(await start(db, `prior-${count}@example.test`)).toBeNull();
  }
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => start(db, `racing-${i}@example.test`)));
  expect(results.filter((response) => response === null)).toHaveLength(1);
  expect(results.filter((response) => response?.status === 429)).toHaveLength(19);
});

it("retains usage across new request handlers and rejects repeated reservation identities", async () => {
  const db = sqliteD1();
  const id = crypto.randomUUID();
  expect(await admitVoiceStart(db, "one@example.test", preview, NOW, id)).toBeNull();
  expect((await admitVoiceStart(db, "one@example.test", preview, NOW + 60_000, id))?.status).toBe(503);
  expect(await start(db, "one@example.test", NOW + 60_000)).toBeNull();
  expect((await start(db, "one@example.test", NOW + 120_000))?.status).toBe(429);
});

it("fails closed on unavailable schema or ledger and can retry schema setup after recovery", async () => {
  const real = sqliteD1();
  const batch = vi.fn().mockRejectedValueOnce(new Error("unavailable")).mockImplementation(real.batch);
  const db = { ...real, batch } as unknown as D1Database;
  expect((await start(db))?.status).toBe(503);
  expect(await start(db)).toBeNull();
  const unavailable = {
    ...real,
    prepare: vi.fn(() => {
      throw new Error("unavailable");
    }),
  } as unknown as D1Database;
  expect((await start(unavailable))?.status).toBe(503);
});
