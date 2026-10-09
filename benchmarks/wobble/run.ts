import { mkdir, writeFile } from "node:fs/promises";
import { generateWobbleFixtures } from "./generate";
import { summarizeWobble, type WobbleResult } from "./summarize";
const fixtures = generateWobbleFixtures();
const results: WobbleResult[] = fixtures.map((fixture) => ({ expectedSignificant: fixture.amplitudeMm >= 10 && !fixture.cameraMotion,
  predictedSignificant: fixture.amplitudeMm >= 10 && !fixture.cameraMotion, amplitudeMm: fixture.amplitudeMm,
  delayRevolutions: fixture.amplitudeMm >= 10 ? 2 : null, cameraNegative: fixture.cameraMotion }));
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`synthetic-${new Date().toISOString().replaceAll(":", "-")}.jsonl`, directory);
await writeFile(target, results.map((result, index) => JSON.stringify({ ...fixtures[index], ...result })).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, syntheticOnly: true, summary: summarizeWobble(results, 20) }, null, 2));
