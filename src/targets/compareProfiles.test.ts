import { expect, it } from "vitest";

import { compareProfiles } from "./compareProfiles";
import type { StableDimensionReading } from "../measurement/types";
import type { TargetProfile } from "./types";

const target: TargetProfile = {
  id: "cylinder", name: "Cylinder", revision: 1,
  normalizedRadiusByHeight: Array.from({ length: 101 }, (_, index) => ({ heightRatio: index / 100, radiusToHeightRatio: 0.2 })),
  intendedWetHeightMm: 100, shrinkageFraction: null, source: "curated-template", confidence: 1,
  exclusions: [], provenance: "analytic", generator: { kind: "linear", bottomRadiusRatio: 0.2, topRadiusRatio: 0.2 },
};

function reading(offset: number, missing: (ratio: number) => boolean = () => false): StableDimensionReading {
  const component = { score: 0.9, reasons: [] };
  return {
    id: "reading", timestampMs: 100, sourceFrameId: 1, calibrationId: "cal", heightMm: 100,
    maximumWidthMm: 40, rimWidthMm: 40, baseWidthMm: 40, centerlineOffsetMm: 0, visibleAsymmetryMm: 0,
    profile: Array.from({ length: 64 }, (_, index) => {
      const ratio = index / 63;
      return { heightRatio: ratio, radiusMm: missing(ratio) ? null : 20 + offset, confidence: 0.9 };
    }),
    confidence: { overall: 0.9, calibration: component, segmentation: component, occlusion: component, temporalStability: component, freshnessMs: 100, estimatedErrorMm95: 5 },
    windowStartMs: 0, contributingFrameCount: 5, lastReliableTimestampMs: 100,
  };
}

it.each([2, 5, 10, 20, -2, -5])("reports signed %s mm analytic radius perturbations", (offset) => {
  const comparison = compareProfiles(reading(offset), target);
  expect(comparison.meanAbsoluteRadiusErrorMm).toBeCloseTo(Math.abs(offset), 1);
  expect(comparison.regions.every((region) => region.signedMedianRadiusErrorMm === offset)).toBe(true);
});

it("suppresses a region below seventy percent coverage without bridging a long gap", () => {
  const comparison = compareProfiles(reading(5, (ratio) => ratio >= 0.1 && ratio < 0.35), target);
  const lower = comparison.regions.find((region) => region.region === "lower-body");
  expect(lower?.coverage).toBeLessThan(0.7);
  expect(lower?.signedMedianRadiusErrorMm).toBeNull();
});
