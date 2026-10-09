import scripts from "./scripts.json" with { type: "json" };
import { mkdir, writeFile } from "node:fs/promises";
import { summarizeVoice, type VoiceResult } from "./summarize";
import { buildBenchmarkRun, checksum } from "../shared/envelope";
const iterations = Number(process.argv.find((value) => value.startsWith("--iterations="))?.split("=")[1] ?? 20);
const rows: VoiceResult[] = Array.from({ length: iterations * scripts.length }, (_, index) => ({ responseMs: 500 + index % 200,
  bargeInMs: 80 + index % 50, toolRoundTripMs: 100 + index % 80, reconnectMs: 500 + index % 250,
  inputTokens: 0, outputTokens: 0, costUsd: 0 }));
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`mock-${new Date().toISOString().replaceAll(":", "-")}.jsonl`, directory);
const startedAt = new Date().toISOString();
await writeFile(target, rows.map((row, index) => { const script = scripts[index % scripts.length]!; return JSON.stringify({
  ...buildBenchmarkRun({ benchmarkVersion: "voice-v1", fixtureId: script.id, metrics: row, exclusions: [],
    unmeasurableCount: 0, artifactChecksums: [checksum(JSON.stringify(script))], config: { provider: "mock", model: "mock-v1" },
    environment: { startedAt } }), scriptId: script.id, profile: script.profile, provider: "mock", model: "mock-v1",
  pricingDate: "not-applicable", result: row }); }).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, provider: "mock", model: "mock-v1", paidCredentialUsed: false, summary: summarizeVoice(rows) }, null, 2));
