import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { summarizeDimensions, type DimensionResult } from "./summarize";

const rows: DimensionResult[] = Array.from({ length: 40 }, (_, index) => ({ errorMm: ((index % 7) - 3) * 0.8,
  supported: index < 36, accepted: index < 36 }));
const artifact = rows.map((row, index) => JSON.stringify({ fixtureId: `synthetic-${index}`, ...row,
  checksum: createHash("sha256").update(JSON.stringify(row)).digest("hex") })).join("\n") + "\n";
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`synthetic-${new Date().toISOString().replaceAll(":", "-")}.jsonl`, directory);
await writeFile(target, artifact, { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, syntheticOnly: true, summary: summarizeDimensions(rows) }, null, 2));
