import Dexie, { type EntityTable } from "dexie";
import type {
  MarkedMoment, RecordedReading, SessionBundle, SessionDiagnostic, SessionEvent,
  SessionRecord, StoredBlob, TranscriptEntry,
} from "./types";

class SessionDatabase extends Dexie {
  sessions!: EntityTable<SessionRecord, "id">;
  readings!: EntityTable<RecordedReading, "id">;
  diagnostics!: EntityTable<SessionDiagnostic, "id">;
  events!: EntityTable<SessionEvent, "id">;
  moments!: EntityTable<MarkedMoment, "id">;
  transcripts!: EntityTable<TranscriptEntry, "id">;
  blobs!: EntityTable<StoredBlob, "id">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      sessions: "id, startedAtMs, endedAtMs, outcome",
      readings: "id, sessionId, [sessionId+timestampMs]",
      diagnostics: "id, sessionId, [sessionId+timestampMs]",
      events: "id, sessionId, [sessionId+timestampMs], type",
      moments: "id, sessionId, [sessionId+timestampMs]",
      transcripts: "id, sessionId, [sessionId+timestampMs]",
      blobs: "id, sessionId",
    });
  }
}

export class SessionRepository {
  private readonly db: SessionDatabase;

  constructor(name = "pottery-coach") { this.db = new SessionDatabase(name); }

  async create(record: SessionRecord) { await this.db.sessions.add(structuredClone(record)); }

  private async requireSession(sessionId: string) {
    const session = await this.db.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} does not exist`);
    return session;
  }

  async appendReading(reading: RecordedReading) {
    await this.db.transaction("rw", this.db.sessions, this.db.readings, async () => {
      await this.requireSession(reading.sessionId);
      await this.db.readings.add(structuredClone(reading));
    });
  }

  async appendDiagnostic(diagnostic: SessionDiagnostic) {
    await this.db.transaction("rw", this.db.sessions, this.db.diagnostics, async () => {
      await this.requireSession(diagnostic.sessionId);
      await this.db.diagnostics.add(structuredClone(diagnostic));
    });
  }

  async appendEvent(event: SessionEvent) {
    await this.db.transaction("rw", this.db.sessions, this.db.events, async () => {
      await this.requireSession(event.sessionId);
      await this.db.events.add(structuredClone(event));
    });
  }

  async appendTranscript(sessionId: string, text: string, timestampMs: number) {
    const session = await this.requireSession(sessionId);
    if (!session.consent.transcriptRetention) throw new Error("Transcript retention is not enabled");
    await this.db.transcripts.add({ id: crypto.randomUUID(), sessionId, timestampMs, text });
  }

  async markMoment(moment: MarkedMoment, still?: Blob) {
    const session = await this.requireSession(moment.sessionId);
    if (!moment.localOnly && !session.consent.snapshotUpload) throw new Error("Snapshot upload consent is not enabled");
    await this.db.transaction("rw", this.db.moments, this.db.blobs, async () => {
      await this.db.moments.add(structuredClone(moment));
      if (still && moment.stillBlobId) await this.db.blobs.add({ id: moment.stillBlobId, sessionId: moment.sessionId, blob: still });
    });
  }

  async get(id: string): Promise<SessionBundle | undefined> {
    const session = await this.db.sessions.get(id);
    if (!session) return undefined;
    const [readings, diagnostics, events, moments, transcripts] = await Promise.all([
      this.db.readings.where("sessionId").equals(id).sortBy("timestampMs"),
      this.db.diagnostics.where("sessionId").equals(id).sortBy("timestampMs"),
      this.db.events.where("sessionId").equals(id).sortBy("timestampMs"),
      this.db.moments.where("sessionId").equals(id).sortBy("timestampMs"),
      this.db.transcripts.where("sessionId").equals(id).sortBy("timestampMs"),
    ]);
    return { session, readings, diagnostics, events, moments, transcripts };
  }

  async listEvents(sessionId: string) { return this.db.events.where("sessionId").equals(sessionId).sortBy("timestampMs"); }
  async list() { return this.db.sessions.orderBy("startedAtMs").reverse().toArray(); }
  async update(id: string, patch: Partial<Pick<SessionRecord, "endedAtMs" | "goal" | "outcome" | "calibrationId">>) {
    await this.requireSession(id);
    await this.db.sessions.update(id, structuredClone(patch));
  }
  async expire(now = Date.now(), retentionMs = 30 * 86_400_000) {
    const expired = (await this.list()).filter((session) => session.endedAtMs !== null && now - session.endedAtMs >= retentionMs);
    await Promise.all(expired.map((session) => this.delete(session.id)));
    return expired.map((session) => session.id);
  }
  async delete(id: string) {
    const exists = Boolean(await this.db.sessions.get(id));
    if (!exists) return false;
    await this.db.transaction("rw", this.db.tables, async () => {
      await Promise.all([
        this.db.readings.where("sessionId").equals(id).delete(),
        this.db.diagnostics.where("sessionId").equals(id).delete(),
        this.db.events.where("sessionId").equals(id).delete(),
        this.db.moments.where("sessionId").equals(id).delete(),
        this.db.transcripts.where("sessionId").equals(id).delete(),
        this.db.blobs.where("sessionId").equals(id).delete(),
      ]);
      await this.db.sessions.delete(id);
    });
    return true;
  }
  async destroy() { this.db.close(); await Dexie.delete(this.db.name); }
}
