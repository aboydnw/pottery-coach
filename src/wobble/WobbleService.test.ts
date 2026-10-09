import { expect, it } from "vitest";
import { WobbleService } from "./WobbleService";
import type { WobbleReading } from "./types";

const significant: WobbleReading = { id: "w", timestampMs: 1_000, amplitudeMm: 10, periodMs: 900,
  classification: "significant-visible-oscillation", confidence: 0.9, evidenceWindowMs: 4_000, observedRevolutions: 4,
  validSampleFraction: 1, cameraMotionRmsMm: 0.2, lastReliableTimestampMs: 1_000, reasons: [], sourceFrameIds: [1, 2] };

it("requires two significant windows and makes stale evidence unmeasurable", () => {
  const service = new WobbleService(); service.update(significant);
  expect(service.getLatest(1_100).classification).toBe("source-ambiguous");
  service.update({ ...significant, timestampMs: 1_900, lastReliableTimestampMs: 1_900, id: "w2" });
  expect(service.getLatest(2_000).classification).toBe("significant-visible-oscillation");
  expect(service.getLatest(3_500)).toMatchObject({ classification: "unmeasurable", amplitudeMm: null, periodMs: null });
});
