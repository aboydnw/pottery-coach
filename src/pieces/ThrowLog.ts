import Dexie, { type EntityTable } from "dexie";
import { addUsage, estimateCostUsd } from "../voice/pricing";
import type { ProviderUsage } from "../voice/types";
import {
  EMPTY_USAGE,
  type CueVerdict,
  type LastingNote,
  type LoggedCue,
  type PieceRecord,
  type SizeCorrection,
  type Syncable,
} from "./types";

export const MAX_LASTING_NOTES = 12;
export const MAX_NOTE_LENGTH = 100;

class ThrowLogDatabase extends Dexie {
  pieces!: EntityTable<PieceRecord, "id">;
  notes!: EntityTable<LastingNote, "id">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ pieces: "id, sessionId, startedAtMs", notes: "id, createdAtMs" });
  }
}

export type NewPiece = Pick<PieceRecord, "sessionId" | "index" | "startedAtMs" | "targetId"> & {
  goalHeightMm: number | null;
  goalBasis: "wet" | "fired" | null;
};

export type PieceOutcome = Pick<
  PieceRecord,
  | "endedAtMs"
  | "sizesAvailable"
  | "peakHeightMm"
  | "finalHeightMm"
  | "finalMaximumWidthMm"
  | "reachedGoalPercent"
  | "markedMoments"
  | "targetId"
  | "goalHeightMm"
  | "goalBasis"
>;

export type SyncKind = "pieces" | "notes";

/**
 * The permanent throw log (one row per pot) and the potter's lasting notes. It lives in its own
 * database so the 30-day expiry of detailed session recordings never touches it.
 */
export class ThrowLog {
  private readonly db: ThrowLogDatabase;

  constructor(
    name = "pottery-coach-log",
    private readonly now: () => number = () => Date.now(),
  ) {
    this.db = new ThrowLogDatabase(name);
  }

  async startPiece(piece: NewPiece): Promise<PieceRecord> {
    const record: PieceRecord = {
      ...piece,
      id: globalThis.crypto.randomUUID(),
      endedAtMs: null,
      sizesAvailable: false,
      peakHeightMm: null,
      finalHeightMm: null,
      finalMaximumWidthMm: null,
      reachedGoalPercent: null,
      markedMoments: 0,
      notes: [],
      corrections: [],
      cues: [],
      usage: EMPTY_USAGE,
      estimatedCostUsd: 0,
      updatedAtMs: this.now(),
      syncedAtMs: null,
    };
    await this.db.pieces.add(record);
    return record;
  }

  async closePiece(id: string, outcome: PieceOutcome): Promise<PieceRecord | null> {
    return this.updatePiece(id, (piece) => ({ ...piece, ...outcome }));
  }

  async addNote(id: string, text: string): Promise<PieceRecord | null> {
    const note = { atMs: this.now(), text: text.trim().slice(0, 500) };
    return this.updatePiece(id, (piece) => ({ ...piece, notes: [...piece.notes, note] }));
  }

  async addCorrection(id: string, correction: SizeCorrection): Promise<PieceRecord | null> {
    return this.updatePiece(id, (piece) => ({ ...piece, corrections: [...piece.corrections, correction] }));
  }

  async logCue(id: string, cue: LoggedCue): Promise<PieceRecord | null> {
    return this.updatePiece(id, (piece) => ({ ...piece, cues: [...piece.cues, cue] }));
  }

  /** Records the potter's reaction to the most recent cue; false when there was no cue to rate. */
  async rateLastCue(id: string, verdict: CueVerdict): Promise<boolean> {
    const updated = await this.updatePiece(id, (piece) =>
      piece.cues.length === 0
        ? piece
        : { ...piece, cues: [...piece.cues.slice(0, -1), { ...piece.cues.at(-1)!, verdict }] },
    );
    return Boolean(updated?.cues.at(-1)?.verdict === verdict);
  }

  async addUsage(id: string, usage: ProviderUsage): Promise<void> {
    await this.updatePiece(id, (piece) => {
      const total = addUsage(piece.usage, usage);
      return { ...piece, usage: total, estimatedCostUsd: estimateCostUsd(total) };
    });
  }

  async getPiece(id: string): Promise<PieceRecord | null> {
    const piece = await this.db.pieces.get(id);
    return piece && !piece.deleted ? piece : null;
  }

  /** Newest first, without deleted pieces. */
  async listPieces(): Promise<PieceRecord[]> {
    const pieces = await this.db.pieces.orderBy("startedAtMs").reverse().toArray();
    return pieces.filter((piece) => !piece.deleted);
  }

  /** Deleting a session removes its pieces too; they stay as tombstones until the deletion is synced. */
  async deleteSession(sessionId: string): Promise<void> {
    const pieces = await this.db.pieces.where("sessionId").equals(sessionId).toArray();
    const now = this.now();
    await this.db.pieces.bulkPut(pieces.map((piece) => ({ ...piece, deleted: true, notes: [], updatedAtMs: now })));
  }

  async listNotes(): Promise<LastingNote[]> {
    const notes = await this.db.notes.orderBy("createdAtMs").toArray();
    return notes.filter((note) => !note.deleted);
  }

  /** Keeps a lasting note; when the list is full, the oldest note makes room. */
  async rememberNote(text: string): Promise<LastingNote> {
    const now = this.now();
    const note: LastingNote = {
      id: globalThis.crypto.randomUUID(),
      text: text.trim().slice(0, MAX_NOTE_LENGTH),
      createdAtMs: now,
      updatedAtMs: now,
      syncedAtMs: null,
    };
    const existing = await this.listNotes();
    const overflow = existing.slice(0, Math.max(0, existing.length + 1 - MAX_LASTING_NOTES));
    await this.db.transaction("rw", this.db.notes, async () => {
      for (const old of overflow) await this.db.notes.put({ ...old, deleted: true, updatedAtMs: now });
      await this.db.notes.add(note);
    });
    return note;
  }

  /** The lasting note that best matches what the potter said, if any word overlaps. */
  async findNote(text: string): Promise<LastingNote | null> {
    const wanted = words(text);
    let best: { note: LastingNote; score: number } | null = null;
    for (const note of await this.listNotes()) {
      const have = words(note.text);
      const score = [...wanted].filter((word) => have.has(word)).length / Math.max(1, wanted.size);
      if (score > 0 && (!best || score > best.score)) best = { note, score };
    }
    return best?.note ?? null;
  }

  async forgetNote(id: string): Promise<void> {
    const note = await this.db.notes.get(id);
    if (note) await this.db.notes.put({ ...note, deleted: true, updatedAtMs: this.now() });
  }

  /** Records changed since they were last synced, including deletions. */
  async unsynced(): Promise<{ pieces: PieceRecord[]; notes: LastingNote[] }> {
    const pending = <T extends Syncable>(rows: T[]) =>
      rows.filter((row) => row.syncedAtMs === null || row.syncedAtMs < row.updatedAtMs);
    return {
      pieces: pending(await this.db.pieces.toArray()),
      notes: pending(await this.db.notes.toArray()),
    };
  }

  async markSynced(kind: SyncKind, rows: Array<{ id: string; updatedAtMs: number }>): Promise<void> {
    const table = this.table(kind);
    await this.db.transaction("rw", table, async () => {
      for (const row of rows) {
        const current = await table.get(row.id);
        // Only if nothing changed since this copy was sent.
        if (current && current.updatedAtMs === row.updatedAtMs)
          await table.put({ ...current, syncedAtMs: row.updatedAtMs });
      }
    });
  }

  /** Merges records from the server; the newer `updatedAtMs` wins. */
  async applyRemote(kind: SyncKind, rows: Array<PieceRecord | LastingNote>): Promise<void> {
    const table = this.table(kind);
    await this.db.transaction("rw", table, async () => {
      for (const row of rows) {
        const current = await table.get(row.id);
        if (!current || current.updatedAtMs < row.updatedAtMs)
          await table.put({ ...row, syncedAtMs: row.updatedAtMs } as never);
      }
    });
  }

  close(): void {
    this.db.close();
  }

  async destroy(): Promise<void> {
    this.db.close();
    await this.db.delete();
  }

  private table(kind: SyncKind): EntityTable<PieceRecord | LastingNote, "id"> {
    return (kind === "pieces" ? this.db.pieces : this.db.notes) as EntityTable<PieceRecord | LastingNote, "id">;
  }

  private async updatePiece(id: string, change: (piece: PieceRecord) => PieceRecord): Promise<PieceRecord | null> {
    return this.db.transaction("rw", this.db.pieces, async () => {
      const piece = await this.db.pieces.get(id);
      if (!piece || piece.deleted) return null;
      const next = { ...change(piece), updatedAtMs: this.now() };
      await this.db.pieces.put(next);
      return next;
    });
  }
}

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2),
  );
}
