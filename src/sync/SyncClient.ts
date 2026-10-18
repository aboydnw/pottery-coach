import type { ThrowLog } from "../pieces/ThrowLog";
import type { LastingNote, PieceRecord } from "../pieces/types";

const SINCE_KEY = "pottery-coach-sync-since";
const MAX_PIECES = 200;
const MAX_NOTES = 50;

export type SyncResult = "synced" | "offline" | "signed-out" | "failed";
type SyncResponse = { serverTime: number; pieces: PieceRecord[]; notes: LastingNote[] };

/**
 * Keeps the throw log and notes in step with the potter's account. Everything is saved on the phone
 * first; this pushes what changed and pulls what other devices changed, in one request.
 */
export class SyncClient {
  private running: Promise<SyncResult> | null = null;

  constructor(
    private readonly throwLog: ThrowLog,
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
    private readonly storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage,
  ) {}

  /** Runs one sync; calls made while one is running share it. */
  sync(): Promise<SyncResult> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<SyncResult> {
    if (globalThis.navigator?.onLine === false) return "offline";
    const unsynced = await this.throwLog.unsynced();
    // The server takes at most this many per request; the rest go on the next sync.
    const pending = { pieces: unsynced.pieces.slice(0, MAX_PIECES), notes: unsynced.notes.slice(0, MAX_NOTES) };
    const since = Number(this.storage?.getItem(SINCE_KEY) ?? 0) || 0;
    let response: Response;
    try {
      response = await this.fetchImpl("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          since,
          pieces: pending.pieces.map(withoutSyncState),
          notes: pending.notes.map(withoutSyncState),
        }),
      });
    } catch {
      return "offline";
    }
    if (response.status === 401) return "signed-out";
    if (!response.ok) return "failed";
    const body = (await response.json()) as SyncResponse;
    await this.throwLog.markSynced("pieces", pending.pieces);
    await this.throwLog.markSynced("notes", pending.notes);
    await this.throwLog.applyRemote("pieces", body.pieces);
    await this.throwLog.applyRemote("notes", body.notes);
    this.storage?.setItem(SINCE_KEY, String(body.serverTime));
    return "synced";
  }
}

function withoutSyncState<T extends { syncedAtMs: number | null }>(row: T): Omit<T, "syncedAtMs"> {
  const { syncedAtMs: _syncedAtMs, ...rest } = row;
  return rest;
}
