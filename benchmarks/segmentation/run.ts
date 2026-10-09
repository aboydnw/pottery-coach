import { mkdir, writeFile } from "node:fs/promises";
import { summarizeSegmentation, type SegmentationResult } from "./summarize";
import { buildBenchmarkRun, checksum } from "../shared/envelope";
const colors = ["white", "red", "brown", "dark"];
const rows: SegmentationResult[] = Array.from({ length: 40 }, (_, index) => ({ boundaryErrorMm: 1 + (index % 3) * 0.5,
  occlusionFraction: index % 5 === 0 ? 0.4 : 0.1, measurable: index % 5 !== 0 }));
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`synthetic-${new Date().toISOString().replaceAll(":", "-")}.jsonl`, directory);
const startedAt = new Date().toISOString();
await writeFile(target, rows.map((row, index) => JSON.stringify({ ...buildBenchmarkRun({ benchmarkVersion: "segmentation-v1",
  fixtureId: `synthetic-${colors[index % colors.length]}-${index}`, metrics: { boundaryErrorMm: row.boundaryErrorMm,
    occlusionFraction: row.occlusionFraction, measurable: row.measurable ? 1 : 0 }, exclusions: [],
  unmeasurableCount: row.measurable ? 0 : 1, artifactChecksums: [checksum(JSON.stringify(row))],
  config: { medianBoundaryMm: 3, p95BoundaryMm: 10, occlusionThreshold: 0.3 }, environment: { startedAt } }), result: row })).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, syntheticOnly: true, summary: summarizeSegmentation(rows) }, null, 2));
