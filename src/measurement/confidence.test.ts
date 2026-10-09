import { expect, it } from "vitest";

import { scoreConfidence } from "./confidence";

it("bounds overall confidence by the weakest critical component", () => {
  const confidence = scoreConfidence({
    calibration: { score: 0.9, reasons: [] }, segmentation: { score: 0.8, reasons: [] },
    occlusion: { score: 0.6, reasons: ["HAND_OCCLUSION"] }, temporalStability: { score: 0.95, reasons: [] },
    capturedAtMs: 100, nowMs: 250, calibrationErrorMm95: 4, segmentationErrorMm95: 3,
  });
  expect(confidence.overall).toBe(0.6);
  expect(confidence.freshnessMs).toBe(150);
  expect(confidence.estimatedErrorMm95).toBe(7);
});
