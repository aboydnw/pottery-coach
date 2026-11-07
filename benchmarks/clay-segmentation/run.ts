import { readFile } from "node:fs/promises";

import { validateDatasetSplit, validateReviewedDataset } from "./dataset";

const [path, trainingPath, ...extra] = process.argv.slice(2);
if (!path || path === "--help") {
  console.log("Usage: pnpm benchmark:clay-segmentation <evaluation.jsonl> [training.jsonl]");
  console.log("Checks local reviewed annotations and optional session/ID split isolation. No uploads or training.");
  process.exit(path === "--help" ? 0 : 1);
}
if (extra.length) throw new Error("Expected an evaluation export and optional training export");
const evaluation = validateReviewedDataset(await readFile(path, "utf8"));
if (trainingPath) {
  const training = validateReviewedDataset(await readFile(trainingPath, "utf8"));
  validateDatasetSplit(training, evaluation);
  console.log("Training and evaluation session groups and example IDs are disjoint.");
}
console.log(
  `Validated annotations for ${evaluation.exampleCount} examples across ${evaluation.sessionGroups.length} sessions.`,
);
console.log(
  "Image decoding, license provenance, duplicate-image review, calibration and real-world accuracy remain unverified.",
);
