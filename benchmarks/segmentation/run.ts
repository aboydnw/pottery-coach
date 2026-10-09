import { mkdir, writeFile } from "node:fs/promises";
import { summarizeSegmentation, type SegmentationResult } from "./summarize";
const colors = ["white", "red", "brown", "dark"];
const rows: SegmentationResult[] = Array.from({ length: 40 }, (_, index) => ({ boundaryErrorMm: 1 + (index % 3) * 0.5,
  occlusionFraction: index % 5 === 0 ? 0.4 : 0.1, measurable: index % 5 !== 0 }));
const directory = new URL("./artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
const target = new URL(`synthetic-${new Date().toISOString().replaceAll(":", "-")}.jsonl`, directory);
await writeFile(target, rows.map((row, index) => JSON.stringify({ fixtureId: `synthetic-${colors[index % colors.length]}-${index}`, ...row })).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ artifact: target.pathname, syntheticOnly: true, summary: summarizeSegmentation(rows) }, null, 2));
