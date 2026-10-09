import { mkdir, writeFile } from "node:fs/promises";
import { summarizeDimensions, type DimensionResult } from "./summarize";
import { buildBenchmarkRun, checksum } from "../shared/envelope";

const rows: DimensionResult[] = Array.from({ length: 40 }, (_, index) => ({ errorMm: ((index % 7) - 3) * 0.8,
  supported: index < 36, accepted: index < 36 }));
const startedAt = new Date().toISOString();
const artifact = rows.map((row, index) => JSON.stringify({ ...buildBenchmarkRun({ benchmarkVersion: "dimensions-v1",
  fixtureId: `synthetic-${index}`, metrics: { errorMm: row.errorMm, accepted: row.accepted ? 1 : 0, supported: row.supported ? 1 : 0 },
  exclusions: [], unmeasurableCount: row.errorMm === null ? 1 : 0, artifactChecksums: [checksum(JSON.stringify(row))],
  config: { medianMm: 5, p95Mm: 10, biasMm: 5 }, environment: { startedAt } }), result: row })).join("\n") + "\n";
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`synthetic-${new Date().toISOString().replaceAll(":", "-")}.jsonl`, directory);
await writeFile(target, artifact, { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, syntheticOnly: true, summary: summarizeDimensions(rows) }, null, 2));
