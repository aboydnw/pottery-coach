import { expect, it } from "vitest";

import { estimateCameraTransform } from "./cameraMotion";

it("robustly estimates translation with an outlier", () => {
  const features = [
    { from: { x: 0, y: 0 }, to: { x: 2, y: -1 } },
    { from: { x: 10, y: 0 }, to: { x: 12, y: -1 } },
    { from: { x: 0, y: 10 }, to: { x: 2, y: 9 } },
    { from: { x: 10, y: 10 }, to: { x: 40, y: 40 } },
  ];
  const result = estimateCameraTransform(features);
  expect(result.dxMm).toBeCloseTo(2);
  expect(result.dyMm).toBeCloseTo(-1);
  expect(result.confidence).toBeGreaterThanOrEqual(0.8);
});

it("reports low confidence for a sparse degenerate layout", () => {
  expect(estimateCameraTransform([{ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }]).confidence).toBeLessThan(0.8);
});
