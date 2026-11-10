/** Admission counts are not provider-dollar credits or a maximum session lifetime. */
export const VOICE_START_LIMITS = {
  free: { minute: 1, day: 2, month: 3 },
  paid: { minute: 3, day: 10, month: 60 },
  shared: { day: 20, month: 100 },
} as const;

export type VoiceAdmissionConfig = {
  /** Public voice is deliberately unavailable until metering and server-owned termination exist. */
  mode?: string;
  /** Exact verified account IDs, set server-side only. Never accepted from a request. */
  adminUserIds?: string;
};

const schemaReady = new WeakMap<D1Database, Promise<unknown>>();
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS voice_entitlements (
    user_id TEXT PRIMARY KEY NOT NULL,
    tier TEXT NOT NULL CHECK (tier = 'paid'),
    expires_at INTEGER NOT NULL CHECK (expires_at > 0)
  )`,
  `CREATE TABLE IF NOT EXISTS voice_starts (
    request_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('free', 'paid')),
    started_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS voice_starts_by_user ON voice_starts (user_id, started_at)`,
  `CREATE INDEX IF NOT EXISTS voice_starts_by_time ON voice_starts (started_at)`,
];

/** Only a server-configured, exact authenticated identity can bypass application quotas. */
export function isVoiceAdmin(userId: string, config: VoiceAdmissionConfig): boolean {
  return (config.adminUserIds ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(userId);
}

/**
 * Reserves one provider attempt before contacting OpenAI. The single conditional insert makes
 * shared and account limits atomic across concurrent requests and Worker instances. Failed or
 * uncertain provider attempts remain charged to the start allowance; this is not money billing.
 */
export async function admitVoiceStart(
  db: D1Database,
  userId: string,
  config: VoiceAdmissionConfig,
  now: number,
  requestId: string,
): Promise<Response | null> {
  const mode = config.mode ?? "owner-only";
  if (mode === "off") return unavailable("VOICE_DISABLED");
  if (!["owner-only", "limited-preview"].includes(mode)) return unavailable("VOICE_BUDGET_UNAVAILABLE");
  if (isVoiceAdmin(userId, config)) return null;
  if (mode !== "limited-preview") return unavailable("VOICE_ACCESS_RESTRICTED");
  try {
    await ensureSchema(db);
    const date = new Date(now);
    const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const { free, paid, shared } = VOICE_START_LIMITS;
    const admission = await db
      .prepare(
        `WITH account AS (
           SELECT CASE WHEN EXISTS (
             SELECT 1 FROM voice_entitlements WHERE user_id = ? AND tier = 'paid' AND expires_at > ?
           ) THEN 'paid' ELSE 'free' END AS tier
         )
         INSERT INTO voice_starts (request_id, user_id, tier, started_at)
         SELECT ?, ?, account.tier, ? FROM account
         WHERE (SELECT COUNT(*) FROM voice_starts WHERE started_at >= ?) < ?
           AND (SELECT COUNT(*) FROM voice_starts WHERE started_at >= ?) < ?
           AND (SELECT COUNT(*) FROM voice_starts WHERE user_id = ? AND started_at > ?)
             < CASE account.tier WHEN 'paid' THEN ? ELSE ? END
           AND (SELECT COUNT(*) FROM voice_starts WHERE user_id = ? AND started_at >= ?)
             < CASE account.tier WHEN 'paid' THEN ? ELSE ? END
           AND (SELECT COUNT(*) FROM voice_starts WHERE user_id = ? AND started_at >= ?)
             < CASE account.tier WHEN 'paid' THEN ? ELSE ? END
         RETURNING request_id`,
      )
      .bind(
        userId,
        now,
        requestId,
        userId,
        now,
        month,
        shared.month,
        day,
        shared.day,
        userId,
        now - 60_000,
        paid.minute,
        free.minute,
        userId,
        day,
        paid.day,
        free.day,
        userId,
        month,
        paid.month,
        free.month,
      )
      .first<{ request_id: string }>();
    return admission
      ? null
      : Response.json(
          { error: "VOICE_QUOTA_EXHAUSTED" },
          { status: 429, headers: { "retry-after": "60", "cache-control": "no-store, private" } },
        );
  } catch {
    // No in-memory fallback: a missing or unhealthy durable ledger must not open paid API access.
    return unavailable("VOICE_BUDGET_UNAVAILABLE");
  }
}

function ensureSchema(db: D1Database): Promise<unknown> {
  let ready = schemaReady.get(db);
  if (!ready) {
    ready = db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((error: unknown) => {
      schemaReady.delete(db);
      throw error;
    });
    schemaReady.set(db, ready);
  }
  return ready;
}

function unavailable(error: string): Response {
  return Response.json({ error }, { status: 503, headers: { "cache-control": "no-store, private" } });
}
