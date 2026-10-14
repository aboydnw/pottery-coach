import { mkdir, writeFile } from "node:fs/promises";
import fixtures from "./fixtures.json" with { type: "json" };
import { summarizeSegmentation, type SegmentationResult } from "./summarize";
import { buildBenchmarkRun, checksum } from "../shared/envelope";
import { measureScene } from "../shared/measureScene";
import type { Lab, VesselScene } from "../shared/syntheticScene";

const CLAY: Record<string, Lab> = { white: [82, 1, 8], red: [48, 28, 26], brown: [38, 12, 20], dark: [24, 3, 6] };
const VESSEL_HEIGHT_MM = 120;
const RADIUS_MM = 40;
const cases = fixtures.clayColors.flatMap((clay) => fixtures.lights.flatMap((light) => fixtures.occlusions.map((occlusionFraction) => ({ clay, light, occlusionFraction }))));

const startedAt = new Date().toISOString();
const records = cases.map((fixture, index) => {
  const scene: VesselScene = {
    width: 320, height: 180, mmPerPixel: 1, vesselHeightMm: VESSEL_HEIGHT_MM, radiusMm: () => RADIUS_MM,
    centerOffsetMm: 0, shearDeg: 0, baseRow: 170, background: [58, 0, 2], clay: CLAY[fixture.clay]!, noise: 2, seed: index + 1,
    sideLightGradient: fixture.light === "side" ? 20 : 0, shadow: fixture.light === "shadow",
    brightnessShift: fixture.light === "brightness-change" ? 10 : 0, occlusionFraction: fixture.occlusionFraction,
  };
  const { reading, measurable } = measureScene(scene);
  const row: SegmentationResult = {
    boundaryErrorMm: reading.maximumWidthMm === null ? null : reading.maximumWidthMm - 2 * RADIUS_MM,
    occlusionFraction: fixture.occlusionFraction,
    measurable,
  };
  return { fixture, row };
});

const directory = new URL("./artifacts/", import.meta.url);
await mkdir(directory, { recursive: true });
const target = new URL(`synthetic-${startedAt.replaceAll(":", "-")}.jsonl`, directory);
await writeFile(target, records.map(({ fixture, row }) => JSON.stringify({ ...buildBenchmarkRun({ benchmarkVersion: "segmentation-v2",
  fixtureId: `${fixture.clay}-${fixture.light}-occlusion${fixture.occlusionFraction}`, metrics: { boundaryErrorMm: row.boundaryErrorMm,
    occlusionFraction: row.occlusionFraction, measurable: row.measurable ? 1 : 0 }, exclusions: [],
  unmeasurableCount: row.measurable ? 0 : 1, artifactChecksums: [checksum(JSON.stringify(fixture))],
  config: { medianBoundaryMm: 3, p95BoundaryMm: 10, occlusionThreshold: 0.3 }, environment: { startedAt } }), fixture, result: row })).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, syntheticOnly: true, productCode: ["buildBackground", "segmentVessel", "extractDimensions"],
  summary: summarizeSegmentation(records.map((record) => record.row)) }, null, 2));
