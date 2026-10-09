import { summarizeIntegrated } from "./summarize";
import { mkdir, writeFile } from "node:fs/promises";
const durationSeconds = Number(process.argv.find((value) => value.startsWith("--duration="))?.split("=")[1] ?? 1200);
const samples = Math.max(4, Math.floor(durationSeconds));
const result = { cameraOnlyHz: 10, integratedHz: 9, frameAgesMs: Array.from({ length: samples }, (_, i) => 180 + i % 40),
  pendingFrames: Array.from({ length: samples }, (_, i) => i % 17 === 0 ? 1 : 0), recorderQueue: Array.from({ length: samples }, (_, i) => i % 13),
  memoryBytes: Array.from({ length: samples }, (_, i) => 50_000_000 + (i % 4) * 1_000) };
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`mock-${new Date().toISOString().replaceAll(":", "-")}.json`, directory);
await writeFile(target, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, mode: "deterministic-mock-soak", durationSeconds, summary: summarizeIntegrated(result) }, null, 2));
