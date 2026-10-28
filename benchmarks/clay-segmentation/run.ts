import { readFile } from "node:fs/promises";

import { CLAY_DATASET_SCHEMA } from "../../src/vision/dataset/types";

const path = process.argv[2];
if (!path || path === "--help") {
  console.log("Usage: pnpm benchmark:clay-segmentation <reviewed-dataset.jsonl>");
  console.log("Validates a reviewed local export before offline training or model comparison.");
  process.exit(0);
}

const lines = (await readFile(path, "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { schemaVersion?: string; kind?: string; sessionGroupId?: string });
if (lines[0]?.schemaVersion !== CLAY_DATASET_SCHEMA || lines[0]?.kind !== "manifest")
  throw new Error("The first JSONL row must be a clay-dataset-v1 manifest");
const examples = lines.slice(1);
if (examples.some((example) => example.schemaVersion !== CLAY_DATASET_SCHEMA || !example.sessionGroupId))
  throw new Error("Every dataset example must be versioned and grouped by session");
console.log(
  `Validated ${examples.length} reviewed examples across ${new Set(examples.map((item) => item.sessionGroupId)).size} sessions.`,
);
