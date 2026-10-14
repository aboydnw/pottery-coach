import { mkdir, writeFile } from "node:fs/promises";
import fixtures from "./fixtures.json" with { type: "json" };
import { summarizeDimensions, type DimensionResult } from "./summarize";
import { buildBenchmarkRun, checksum } from "../shared/envelope";
import { measureScene } from "../shared/measureScene";
import type { VesselScene } from "../shared/syntheticScene";

const SUPPORTED_MAX_ANGLE_DEG = 6;
const cases = fixtures.sizesMm.flatMap((sizeMm) => fixtures.offsetsMm.flatMap((offsetMm) => fixtures.anglesDeg.flatMap((angleDeg) =>
  fixtures.placements.map((placement) => ({ sizeMm, offsetMm: placement === "left" ? -offsetMm : offsetMm, angleDeg, placement })))));

const startedAt = new Date().toISOString();
const records = cases.map((fixture, index) => {
  const scene: VesselScene = {
    width: 320, height: 180, mmPerPixel: (fixture.sizeMm * 1.4) / 180, vesselHeightMm: fixture.sizeMm,
    radiusMm: () => fixture.sizeMm * 0.3, centerOffsetMm: fixture.offsetMm, shearDeg: fixture.angleDeg, baseRow: 170,
    background: [55, 0, 2], clay: [72, 8, 18], noise: 2, seed: index + 1,
  };
  const { reading, measurable } = measureScene(scene);
  const row: DimensionResult = {
    errorMm: reading.heightMm === null ? null : reading.heightMm - fixture.sizeMm,
    supported: fixture.angleDeg <= SUPPORTED_MAX_ANGLE_DEG,
    accepted: measurable,
  };
  return { fixture, row };
});

const directory = new URL("./artifacts/", import.meta.url);
await mkdir(directory, { recursive: true });
const target = new URL(`synthetic-${startedAt.replaceAll(":", "-")}.jsonl`, directory);
await writeFile(target, records.map(({ fixture, row }) => JSON.stringify({ ...buildBenchmarkRun({ benchmarkVersion: "dimensions-v2",
  fixtureId: `size${fixture.sizeMm}-offset${fixture.offsetMm}-angle${fixture.angleDeg}-${fixture.placement}`,
  metrics: { errorMm: row.errorMm, accepted: row.accepted ? 1 : 0, supported: row.supported ? 1 : 0 },
  exclusions: [], unmeasurableCount: row.errorMm === null ? 1 : 0, artifactChecksums: [checksum(JSON.stringify(fixture))],
  config: { medianMm: 5, p95Mm: 10, biasMm: 5, supportedMaxAngleDeg: SUPPORTED_MAX_ANGLE_DEG }, environment: { startedAt } }),
  fixture, result: row })).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, syntheticOnly: true, productCode: ["segmentVessel", "extractDimensions"],
  summary: summarizeDimensions(records.map((record) => record.row)) }, null, 2));
