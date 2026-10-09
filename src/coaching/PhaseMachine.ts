import type { PhaseEvent, PhaseEvidence } from "./types";

export class PhaseMachine {
  private current: PhaseEvidence;
  private audit: Array<{ event: PhaseEvent; result: PhaseEvidence }> = [];

  constructor(private readonly now: () => number = () => performance.now()) {
    this.current = { phase: "setup", confidence: 1, source: "initial", timestampMs: this.now(), reasons: [] };
  }

  reduce(event: PhaseEvent): PhaseEvidence {
    if (this.current.phase === "session-ended") return this.record(event, this.current);
    if (event.type === "session-ended") return this.record(event, { phase: "session-ended", confidence: 1, source: "session", timestampMs: this.now(), reasons: [] });
    if (event.type === "user-declared") return this.record(event, { phase: event.phase, confidence: 1, source: "user", timestampMs: this.now(), reasons: [] });
    if (event.type === "contradiction") return this.record(event, { phase: "uncertain", confidence: 0, source: "contradiction", timestampMs: this.now(), reasons: [event.reason] });
    if (event.type === "expired") return this.record(event, { phase: "uncertain", confidence: 0, source: "expired", timestampMs: this.now(), reasons: ["PHASE_EXPIRED"] });
    if (event.type === "shape-corroboration") {
      if (this.current.phase === event.phase && this.current.source === "user") return this.record(event, { ...this.current, confidence: Math.min(1, Math.max(this.current.confidence, event.confidence)), timestampMs: this.now() });
      return this.record(event, { phase: "uncertain", confidence: 0, source: "shape", timestampMs: this.now(), reasons: ["SHAPE_EVIDENCE_CANNOT_AUTHORIZE_PHASE"] });
    }
    return this.current;
  }

  auditLog(): Array<{ event: PhaseEvent; result: PhaseEvidence }> { return this.audit.map((item) => ({ event: { ...item.event }, result: { ...item.result, reasons: [...item.result.reasons] } })); }
  private record(event: PhaseEvent, result: PhaseEvidence): PhaseEvidence { this.current = { ...result, reasons: [...result.reasons] }; this.audit.push({ event, result: this.current }); return { ...this.current, reasons: [...this.current.reasons] }; }
}
