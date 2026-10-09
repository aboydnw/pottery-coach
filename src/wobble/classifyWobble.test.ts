import { expect, it } from "vitest";

import { classifyWobble } from "./classifyWobble";
import type { TemporalContourSample } from "./types";

const samples: TemporalContourSample[] = Array.from({ length: 70 }, (_, index) => ({
  timestampMs: index * 50, frameId: index, centersMm: [0, 0, 0], leftMm: [-10, -10, -10], rightMm: [10, 10, 10],
  rimCenterMm: 0, rimHeightMm: 100, cameraTransformConfidence: 0.95, occluded: false, shapeChangeRate: 0,
}));

it("classifies coherent high-confidence motion as significant visible oscillation", () => {
  const result = classifyWobble(samples, { amplitudeMm: 6, residualRmsMm: 1, phaseRad: 0, offsetMm: 0, trendMmPerMs: 0 }, { periodMs: 1000, cameraMotionRmsMm: 0.2 });
  expect(result.classification).toBe("significant-visible-oscillation");
  expect(result.sourceFrameIds).toHaveLength(70);
});

it("suppresses hand occlusion and weak camera transforms", () => {
  const blocked = samples.map((sample, index) => ({ ...sample, occluded: index < 30, cameraTransformConfidence: 0.7 }));
  const result = classifyWobble(blocked, { amplitudeMm: 8, residualRmsMm: 1, phaseRad: 0, offsetMm: 0, trendMmPerMs: 0 }, { periodMs: 1000, cameraMotionRmsMm: 3 });
  expect(result.classification).toBe("unmeasurable");
  expect(result.reasons).toEqual(expect.arrayContaining(["OCCLUSION", "CAMERA_TRANSFORM_LOW_CONFIDENCE"]));
});
