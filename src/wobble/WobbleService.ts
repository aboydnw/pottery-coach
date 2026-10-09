import type { WobbleReading } from "./types";

export const WOBBLE_PROACTIVE = false;

export class WobbleService {
  private latest: WobbleReading = {
    id: "wobble-unavailable", timestampMs: 0, amplitudeMm: null, periodMs: null,
    classification: "unmeasurable", confidence: 0, evidenceWindowMs: 0, observedRevolutions: 0,
    validSampleFraction: 0, cameraMotionRmsMm: null, lastReliableTimestampMs: null,
    reasons: ["NO_EVIDENCE"], sourceFrameIds: [],
  };
  private previousSignificant = false;

  update(reading: WobbleReading): void {
    if (reading.classification === "significant-visible-oscillation") {
      if (!this.previousSignificant) {
        this.latest = { ...reading, classification: "source-ambiguous", reasons: [...reading.reasons, "AWAITING_SECOND_WINDOW"] };
        this.previousSignificant = true;
        return;
      }
    } else this.previousSignificant = false;
    this.latest = { ...reading, sourceFrameIds: [...reading.sourceFrameIds], reasons: [...reading.reasons] };
  }

  getLatest(nowMs = performance.now()): WobbleReading {
    if (this.latest.lastReliableTimestampMs !== null && nowMs - this.latest.lastReliableTimestampMs > 1500) {
      return { ...this.latest, classification: "unmeasurable", amplitudeMm: null, periodMs: null, reasons: [...this.latest.reasons, "STALE"] };
    }
    return { ...this.latest, sourceFrameIds: [...this.latest.sourceFrameIds], reasons: [...this.latest.reasons] };
  }
}
