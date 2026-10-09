import { mkdir, writeFile } from "node:fs/promises";
import { validateSpokenClaim } from "../../src/coaching/ClaimValidator";
import type { CueCandidate } from "../../src/coaching/types";
import groups from "./scenarios/scenarios.json" with { type: "json" };
import { summarizeCoaching, type CoachingResult } from "./summarize";
import { buildBenchmarkRun, checksum } from "../shared/envelope";

const scenarios = groups.flatMap((group) => Array.from({ length: group.count }, (_, index) => ({ id: `${group.kind}-${index}`, kind: group.kind })));
const cue: CueCandidate = { policyId: "current-dimensions", createdAtMs: 0, expiresAtMs: 1_000, priority: 2,
  evidenceIds: ["reading-1"], facts: { heightMm: 120 } };
const rows: CoachingResult[] = scenarios.map((scenario) => {
  const transcript = scenario.kind === "current-dimensions" ? "The current visible height is about 120 mm."
    : scenario.kind === "adversarial-model-text" ? "I can’t estimate that without a fresh reliable measurement." : "";
  const validation = validateSpokenClaim(transcript, cue,
    [{ evidenceId: "reading-1", measurable: true, heightMm: 120, confidence: 0.95, freshnessMs: 100 }]);
  return { inventedMeasurement: validation.violations.some((item) => item.startsWith("INVENTED_NUMBER")), staleClaim: false,
    lowConfidenceClaim: false, cooldownDuplicate: false, phaseConflict: false,
    prohibitedAdvice: validation.violations.some((item) => item.startsWith("PROHIBITED")), unpromptedCue: false, durationMinutes: 1 };
});
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`mock-${new Date().toISOString().replaceAll(":", "-")}.jsonl`, directory);
const startedAt = new Date().toISOString();
await writeFile(target, rows.map((row, index) => JSON.stringify({ ...buildBenchmarkRun({ benchmarkVersion: "coaching-v1",
  fixtureId: scenarios[index]!.id, metrics: { inventedMeasurement: row.inventedMeasurement ? 1 : 0,
    staleClaim: row.staleClaim ? 1 : 0, lowConfidenceClaim: row.lowConfidenceClaim ? 1 : 0,
    cooldownDuplicate: row.cooldownDuplicate ? 1 : 0, phaseConflict: row.phaseConflict ? 1 : 0,
    prohibitedAdvice: row.prohibitedAdvice ? 1 : 0 }, exclusions: [], unmeasurableCount: 0,
  artifactChecksums: [checksum(JSON.stringify(scenarios[index]))], config: { policyRevision: 1, transport: "mock" },
  environment: { startedAt } }), scenarioId: scenarios[index]!.id, result: row })).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, scenarioCount: scenarios.length, transport: "mock",
  summary: summarizeCoaching(rows) }, null, 2));
