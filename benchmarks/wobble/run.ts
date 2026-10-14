import { mkdir, writeFile } from "node:fs/promises";
import { classifyWobble } from "../../src/wobble/classifyWobble";
import { fitOscillation } from "../../src/wobble/fitOscillation";
import { estimatePeriod } from "../../src/wobble/period";
import type { TemporalContourSample } from "../../src/wobble/types";
import { WobbleService } from "../../src/wobble/WobbleService";
import { generateWobbleFixtures } from "./generate";
import { summarizeWobble, type WobbleResult } from "./summarize";
import { buildBenchmarkRun, checksum } from "../shared/envelope";

const SAMPLE_HZ = 10;
const DURATION_MS = 20_000;
const WINDOW_MS = 12_000;
const STEP_MS = 500;
const SIGNIFICANT_MM = 5;

// The worker does not yet estimate camera motion (cameraMotionRmsMm is always null), so a shaking
// camera is simulated as the same rim-centre oscillation the pipeline would see. Camera-negative
// rows therefore measure what the product does today, not what the spec intends.
function simulate(fixture: ReturnType<typeof generateWobbleFixtures>[number]): WobbleResult {
  let state = (fixture.seed * 31 + fixture.amplitudeMm * 1_000 + fixture.periodMs) >>> 0;
  const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
  const motionMm = fixture.cameraMotion ? 6 : 0;
  const samples: TemporalContourSample[] = Array.from({ length: (DURATION_MS / 1000) * SAMPLE_HZ }, (_, index) => {
    const timestampMs = index * (1000 / SAMPLE_HZ);
    const occluded = random() < fixture.occlusionFraction;
    const center = fixture.amplitudeMm * Math.sin((2 * Math.PI * timestampMs) / fixture.periodMs)
      + motionMm * Math.sin((2 * Math.PI * timestampMs) / 1800) + (random() - 0.5) * 0.6;
    return { timestampMs, frameId: index, centersMm: [occluded ? null : center], leftMm: [null], rightMm: [null],
      rimCenterMm: occluded ? null : center, rimHeightMm: 120, cameraTransformConfidence: 1, occluded, shapeChangeRate: 0 };
  });
  const service = new WobbleService();
  let firstSignificantMs: number | null = null;
  for (let end = 3_000; end <= DURATION_MS; end += STEP_MS) {
    const window = samples.filter((sample) => sample.timestampMs <= end && sample.timestampMs > end - WINDOW_MS);
    const periodSamples = window.flatMap((sample) => sample.rimCenterMm === null ? [] : [{ timestampMs: sample.timestampMs, value: sample.rimCenterMm }]);
    const period = estimatePeriod(periodSamples, { minMs: 300, maxMs: 3000 });
    if (!period || periodSamples.length < 20) continue;
    service.update(classifyWobble(window, fitOscillation(periodSamples, period.periodMs), { periodMs: period.periodMs, cameraMotionRmsMm: null }));
    if (firstSignificantMs === null && service.getLatest(end).classification === "significant-visible-oscillation") firstSignificantMs = end;
  }
  return {
    expectedSignificant: fixture.amplitudeMm >= SIGNIFICANT_MM && !fixture.cameraMotion,
    predictedSignificant: firstSignificantMs !== null,
    amplitudeMm: fixture.amplitudeMm,
    delayRevolutions: firstSignificantMs === null ? null : firstSignificantMs / fixture.periodMs,
    cameraNegative: fixture.cameraMotion,
  };
}

const fixtures = generateWobbleFixtures();
const results = fixtures.map(simulate);
const startedAt = new Date().toISOString();
const directory = new URL("./artifacts/", import.meta.url);
await mkdir(directory, { recursive: true });
const target = new URL(`synthetic-${startedAt.replaceAll(":", "-")}.jsonl`, directory);
await writeFile(target, results.map((result, index) => JSON.stringify({ ...buildBenchmarkRun({ benchmarkVersion: "wobble-v2",
  fixtureId: fixtures[index]!.id, metrics: { amplitudeMm: result.amplitudeMm, predictedSignificant: result.predictedSignificant ? 1 : 0,
    delayRevolutions: result.delayRevolutions }, exclusions: [], unmeasurableCount: 0,
  artifactChecksums: [checksum(JSON.stringify(fixtures[index]))], config: { sampleHz: SAMPLE_HZ, windowMs: WINDOW_MS, stepMs: STEP_MS },
  environment: { startedAt } }), fixture: fixtures[index], result })).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, syntheticOnly: true, productCode: ["estimatePeriod", "fitOscillation", "classifyWobble", "WobbleService"],
  summary: summarizeWobble(results, (DURATION_MS / 60_000) * fixtures.length) }, null, 2));
