import scripts from "./scripts.json" with { type: "json" };
import { mkdir, writeFile } from "node:fs/promises";
import { summarizeVoice, type VoiceResult } from "./summarize";
const iterations = Number(process.argv.find((value) => value.startsWith("--iterations="))?.split("=")[1] ?? 20);
const rows: VoiceResult[] = Array.from({ length: iterations * scripts.length }, (_, index) => ({ responseMs: 500 + index % 200,
  bargeInMs: 80 + index % 50, toolRoundTripMs: 100 + index % 80, reconnectMs: 500 + index % 250,
  inputTokens: 0, outputTokens: 0, costUsd: 0 }));
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`mock-${new Date().toISOString().replaceAll(":", "-")}.jsonl`, directory);
await writeFile(target, rows.map((row, index) => JSON.stringify({ scriptId: scripts[index % scripts.length]!.id,
  profile: scripts[index % scripts.length]!.profile, provider: "mock", model: "mock-v1", pricingDate: "not-applicable", ...row })).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, provider: "mock", model: "mock-v1", paidCredentialUsed: false, summary: summarizeVoice(rows) }, null, 2));
