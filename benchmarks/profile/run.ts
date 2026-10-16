import { compareProfiles } from "../../src/targets/compareProfiles";
import { loadTemplates } from "../../src/targets/loadTemplates";
import type { StableDimensionReading } from "../../src/measurement/types";
import type { ProfileRegion } from "../../src/targets/types";
import { generateProfileFixtures } from "./generate";
import { summarizeProfile } from "./summarize";

const REGIONS: Record<ProfileRegion, [number, number]> = {
  base: [0, 0.1],
  "lower-body": [0.1, 0.5],
  "upper-body": [0.5, 0.9],
  rim: [0.9, 1.001],
};
const target = loadTemplates().find((template) => template.id === "straight-cylinder-v1")!;

function readingWithDelta(region: ProfileRegion, deltaMm: number, noiseMm: number): StableDimensionReading {
  const [start, end] = REGIONS[region];
  const component = { score: 1, reasons: [] };
  return {
    id: `${region}-${deltaMm}`,
    timestampMs: 0,
    sourceFrameId: 0,
    calibrationId: "synthetic",
    unit: "mm",
    height: target.intendedWetHeightMm,
    maximumWidth: null,
    rimWidth: null,
    baseWidth: null,
    centerlineOffset: 0,
    visibleAsymmetry: 0,
    profile: Array.from({ length: 64 }, (_, index) => {
      const heightRatio = index / 63;
      const targetSample = target.normalizedRadiusByHeight[Math.round(heightRatio * 100)]!;
      const delta = heightRatio >= start && heightRatio < end ? deltaMm : 0;
      return {
        heightRatio,
        radius: targetSample.radiusToHeightRatio * target.intendedWetHeightMm + delta + noiseMm,
        confidence: 1,
      };
    }),
    confidence: {
      overall: 1,
      calibration: component,
      segmentation: component,
      occlusion: component,
      temporalStability: component,
      freshnessMs: 0,
      estimatedError95: 0,
    },
    windowStartMs: 0,
    contributingFrameCount: 5,
    lastReliableTimestampMs: 0,
  };
}

const fixtures = generateProfileFixtures(42);
const rows = fixtures.map((fixture) => {
  const comparison = compareProfiles(
    readingWithDelta(fixture.region as ProfileRegion, fixture.deltaMm, fixture.noiseMm),
    target,
  );
  const measured =
    comparison.regions.find((region) => region.region === fixture.region)?.signedMedianRadiusErrorMm ?? Number.NaN;
  return { expectedDeltaMm: fixture.deltaMm, measuredDeltaMm: measured };
});
console.log(
  JSON.stringify(
    { seed: 42, fixtureCount: fixtures.length, productCode: ["compareProfiles"], summary: summarizeProfile(rows) },
    null,
    2,
  ),
);
