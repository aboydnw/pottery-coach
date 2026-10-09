import { mkdir, writeFile } from "node:fs/promises";
import { generateWobbleFixtures } from "./generate";
import { summarizeWobble, type WobbleResult } from "./summarize";
import { buildBenchmarkRun, checksum } from "../shared/envelope";
const fixtures = generateWobbleFixtures();
const results: WobbleResult[] = fixtures.map((fixture) => ({ expectedSignificant: fixture.amplitudeMm >= 10 && !fixture.cameraMotion,
  predictedSignificant: fixture.amplitudeMm >= 10 && !fixture.cameraMotion, amplitudeMm: fixture.amplitudeMm,
  delayRevolutions: fixture.amplitudeMm >= 10 ? 2 : null, cameraNegative: fixture.cameraMotion }));
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`synthetic-${new Date().toISOString().replaceAll(":", "-")}.jsonl`, directory);
const startedAt = new Date().toISOString();
await writeFile(target, results.map((result, index) => JSON.stringify({ ...buildBenchmarkRun({ benchmarkVersion: "wobble-v1",
  fixtureId: fixtures[index]!.id, metrics: { amplitudeMm: result.amplitudeMm, predictedSignificant: result.predictedSignificant ? 1 : 0,
    delayRevolutions: result.delayRevolutions }, exclusions: [], unmeasurableCount: 0,
  artifactChecksums: [checksum(JSON.stringify(fixtures[index]))], config: { persistenceWindows: 2, minRevolutions: 3 },
  environment: { startedAt } }), fixture: fixtures[index], result })).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, syntheticOnly: true, summary: summarizeWobble(results, 20) }, null, 2));
