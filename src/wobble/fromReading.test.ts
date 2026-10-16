import { expect, it } from "vitest";
import { contourSampleFromReading } from "./fromReading";
import type { DimensionReading } from "../measurement/types";

it("downsamples a reading into bounded contour bands without retaining a mask", () => {
  const component = { score: 0.9, reasons: [] };
  const reading = {
    id: "r",
    timestampMs: 1,
    sourceFrameId: 2,
    calibrationId: "c",
    unit: "mm",
    height: 10,
    maximumWidth: 8,
    rimWidth: 6,
    baseWidth: 5,
    centerlineOffset: 1,
    visibleAsymmetry: 2,
    profile: Array.from({ length: 64 }, (_, i) => ({
      heightRatio: i / 63,
      radius: i % 9 === 0 ? null : 4,
      confidence: 0.9,
    })),
    confidence: {
      overall: 0.9,
      calibration: component,
      segmentation: component,
      occlusion: component,
      temporalStability: component,
      freshnessMs: 0,
      estimatedError95: 2,
    },
  } as DimensionReading;
  const sample = contourSampleFromReading(reading, 7);
  expect(sample.centersMm).toHaveLength(7);
  expect(sample.leftMm).toHaveLength(7);
  expect(JSON.stringify(sample)).not.toMatch(/mask|pixel/i);
});
