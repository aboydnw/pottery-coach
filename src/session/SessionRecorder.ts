import type { SessionRepository } from "./SessionRepository";
import type { RecordedReading, SessionDiagnostic, SessionEvent } from "./types";

type QueueItem =
  | { kind: "reading"; value: RecordedReading }
  | { kind: "diagnostic"; value: SessionDiagnostic }
  | { kind: "event"; value: SessionEvent };

export class SessionRecorder {
  private queue: QueueItem[] = [];
  private flushing: Promise<void> | null = null;
  private lastReadingAt = -Infinity;
  private lastDiagnosticAt = -Infinity;
  readonly dropped = { diagnostic: 0, evidence: 0 };

  constructor(private repository: SessionRepository, private sessionId: string,
    private options: { maxQueue?: number; autoFlush?: boolean } = {}) {}

  recordReading(value: RecordedReading) {
    if (value.sessionId !== this.sessionId || value.timestampMs - this.lastReadingAt < 500) return;
    this.lastReadingAt = value.timestampMs;
    this.enqueue({ kind: "reading", value });
  }

  recordDiagnostic(value: SessionDiagnostic) {
    if (value.sessionId !== this.sessionId || value.timestampMs - this.lastDiagnosticAt < 1_000) return;
    this.lastDiagnosticAt = value.timestampMs;
    this.enqueue({ kind: "diagnostic", value });
  }

  recordEvent(value: SessionEvent) {
    if (value.sessionId === this.sessionId) this.enqueue({ kind: "event", value });
  }

  private enqueue(item: QueueItem) {
    const maxQueue = this.options.maxQueue ?? 100;
    if (this.queue.length >= maxQueue) {
      const diagnosticIndex = this.queue.findIndex((queued) => queued.kind === "diagnostic");
      if (diagnosticIndex >= 0) {
        this.queue.splice(diagnosticIndex, 1);
        this.dropped.diagnostic++;
      } else {
        this.dropped.evidence++;
        return;
      }
    }
    this.queue.push(item);
    if (this.options.autoFlush !== false) void this.flush();
  }

  async flush() {
    if (this.flushing) await this.flushing;
    this.flushing = this.drain();
    try { await this.flushing; } finally { this.flushing = null; }
  }

  private async drain() {
    while (this.queue.length) {
      const item = this.queue.shift()!;
      if (item.kind === "reading") await this.repository.appendReading(item.value);
      else if (item.kind === "diagnostic") await this.repository.appendDiagnostic(item.value);
      else await this.repository.appendEvent(item.value);
    }
  }
}
