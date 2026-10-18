import { z } from "zod";

const MAX_BODY_BYTES = 512_000;
const MAX_RECORD_BYTES = 32_000;
const KINDS = ["pieces", "notes"] as const;
type Kind = (typeof KINDS)[number];

const SCHEMA = KINDS.flatMap((kind) => [
  `CREATE TABLE IF NOT EXISTS ${kind} (user_id TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, updated_at INTEGER NOT NULL, synced_at INTEGER NOT NULL, PRIMARY KEY (user_id, id))`,
  `CREATE INDEX IF NOT EXISTS ${kind}_by_sync ON ${kind} (user_id, synced_at)`,
]);

const record = z.looseObject({ id: z.string().min(1).max(100), updatedAtMs: z.number().int().nonnegative() });
const syncRequestSchema = z.object({
  since: z.number().int().nonnegative(),
  pieces: z.array(record).max(200),
  notes: z.array(record).max(50),
});

type SyncRecord = z.infer<typeof record>;
export type SyncDependencies = { db: D1Database; userId: string; now(): number };

const schemaReady = new WeakMap<D1Database, Promise<unknown>>();

/**
 * One round trip of sync: stores the potter's changed throw-log rows (the newer `updatedAtMs` wins)
 * and returns every row that changed on the server since `since`. Rows are kept per signed-in user.
 */
export async function handleSync(request: Request, dependencies: SyncDependencies): Promise<Response> {
  if (request.method !== "POST")
    return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "POST" } });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
    return Response.json({ error: "TOO_LARGE" }, { status: 413 });
  let body: z.infer<typeof syncRequestSchema>;
  try {
    const parsed = syncRequestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "INVALID_SYNC" }, { status: 400 });
    body = parsed.data;
  } catch {
    return Response.json({ error: "INVALID_SYNC" }, { status: 400 });
  }
  const { db, userId } = dependencies;
  await ensureSchema(db);
  const serverTime = dependencies.now();
  const writes = KINDS.flatMap((kind) =>
    body[kind].flatMap((row) => {
      const json = JSON.stringify(row);
      return json.length > MAX_RECORD_BYTES ? [] : [upsert(db, kind, userId, row, json, serverTime)];
    }),
  );
  if (writes.length) await db.batch(writes);
  const [pieces, notes] = await Promise.all(KINDS.map((kind) => changedSince(db, kind, userId, body.since)));
  return Response.json({ serverTime, pieces, notes });
}

function ensureSchema(db: D1Database): Promise<unknown> {
  let ready = schemaReady.get(db);
  if (!ready) {
    ready = db.batch(SCHEMA.map((sql) => db.prepare(sql)));
    schemaReady.set(db, ready);
  }
  return ready;
}

function upsert(db: D1Database, kind: Kind, userId: string, row: SyncRecord, json: string, serverTime: number) {
  return db
    .prepare(
      `INSERT INTO ${kind} (user_id, id, json, updated_at, synced_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at, synced_at = excluded.synced_at
       WHERE excluded.updated_at > ${kind}.updated_at`,
    )
    .bind(userId, row.id, json, row.updatedAtMs, serverTime);
}

async function changedSince(db: D1Database, kind: Kind, userId: string, since: number): Promise<unknown[]> {
  const { results } = await db
    .prepare(`SELECT json FROM ${kind} WHERE user_id = ? AND synced_at >= ? ORDER BY updated_at`)
    .bind(userId, since)
    .all<{ json: string }>();
  return results.map((row) => JSON.parse(row.json) as unknown);
}
