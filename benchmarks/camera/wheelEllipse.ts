import { performance } from "node:perf_hooks";

import { fitWheelEllipseProposals, traceWheelArcs } from "../../src/calibration/wheelArcs";
import { extractWheelEdges } from "../../src/calibration/wheelEdges";
import { detectWheelEllipses } from "../../src/calibration/wheelEllipse";

const width = 320;
const height = 240;
const scenes = [renderScene(190, 65, false), renderScene(65, 190, true), renderScene(118, 150, true)];
const samples: Array<{ edgesMs: number; arcsAndFitMs: number; totalMs: number }> = [];

for (let warmup = 0; warmup < 5; warmup += 1) for (const scene of scenes) detectWheelEllipses(scene);
for (let run = 0; run < 20; run += 1) {
  for (const scene of scenes) {
    const started = performance.now();
    const edges = extractWheelEdges(scene);
    const edgesDone = performance.now();
    fitWheelEllipseProposals(traceWheelArcs(edges), scene);
    const fitDone = performance.now();
    const candidates = detectWheelEllipses(scene);
    const complete = performance.now();
    if (candidates.length === 0) throw new Error("benchmark scene produced no supported wheel rim");
    samples.push({
      edgesMs: edgesDone - started,
      arcsAndFitMs: fitDone - edgesDone,
      totalMs: complete - fitDone,
    });
  }
}

const result = {
  benchmarkVersion: "wheel-ellipse-v1",
  resolution: `${width}x${height}`,
  runs: samples.length,
  medianEdgesMs: median(samples.map((sample) => sample.edgesMs)),
  medianArcsAndFitMs: median(samples.map((sample) => sample.arcsAndFitMs)),
  medianDetectionMs: median(samples.map((sample) => sample.totalMs)),
  p95DetectionMs: percentile(
    samples.map((sample) => sample.totalMs),
    0.95,
  ),
  budgetMs: 200,
};

if (result.medianDetectionMs > result.budgetMs)
  throw new Error(`wheel detector median ${result.medianDetectionMs.toFixed(1)} ms exceeds ${result.budgetMs} ms`);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function renderScene(background: number, rim: number, clutter: boolean) {
  const gray = new Float32Array(width * height).fill(background);
  for (let sector = 0; sector < 96; sector += 1) {
    const angle = (sector / 96) * Math.PI * 2;
    for (let step = 0; step < 5; step += 1) {
      const fineAngle = angle + ((step / 5) * (Math.PI * 2)) / 96;
      for (let thickness = -1; thickness <= 1; thickness += 1) {
        const x = Math.round(164 + (104 + thickness) * Math.cos(fineAngle));
        const y = Math.round(176 + (43 + thickness) * Math.sin(fineAngle));
        gray[y * width + x] = rim;
      }
    }
  }
  if (clutter) {
    for (let y = 35; y < 110; y += 1) {
      for (let x = 30; x < 95; x += 1) {
        if (((x - 62) / 32) ** 2 + ((y - 72) / 38) ** 2 <= 1) gray[y * width + x] = 160;
      }
    }
  }
  return { gray, width, height };
}

function median(values: number[]): number {
  return percentile(values, 0.5);
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
}
