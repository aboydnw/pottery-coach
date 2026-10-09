import { expect, it } from "vitest";

import { TemporalFilter } from "./temporalFilter";
import type { DimensionReading } from "./types";

function reading(frame: number, height = 100, overall = 0.9): DimensionReading {
  const component = { score: overall, reasons: [] };
  return {
    id: `r-${frame}`, timestampMs: frame * 100, sourceFrameId: frame, calibrationId: "cal-1",
    heightMm: height, maximumWidthMm: 50, rimWidthMm: 45, baseWidthMm: 48,
    centerlineOffsetMm: 0, visibleAsymmetryMm: 0,
    profile: Array.from({ length: 64 }, (_, index) => ({ heightRatio: index / 63, radiusMm: index === 10 ? null : 25, confidence: index === 10 ? 0 : 1 })),
    confidence: { overall, calibration: component, segmentation: component, occlusion: component, temporalStability: component, freshnessMs: 0, estimatedErrorMm95: 5 },
  };
}

it("requires five reliable samples before publishing a stable reading", () => {
  const filter = new TemporalFilter(() => 500);
  for (let frame = 1; frame < 5; frame += 1) expect(filter.push(reading(frame))).toBeNull();
  expect(filter.push(reading(5))).toEqual(expect.objectContaining({ contributingFrameCount: 5, heightMm: 100 }));
});

it("rejects a Hampel outlier and preserves profile gaps", () => {
  const filter = new TemporalFilter(() => 600);
  [100, 101, 99, 100, 100].forEach((height, index) => filter.push(reading(index + 1, height)));
  const stable = filter.push(reading(6, 1000));
  expect(stable?.heightMm).toBeLessThan(110);
  expect(stable?.profile[10]?.radiusMm).toBeNull();
});

it("emits no retained current value during occlusion and resets explicitly", () => {
  const filter = new TemporalFilter(() => 600);
  for (let frame = 1; frame <= 5; frame += 1) filter.push(reading(frame));
  expect(filter.push(reading(6, 100, 0.2))).toBeNull();
  filter.reset("visibility-change");
  expect(filter.push(reading(7))).toBeNull();
});
