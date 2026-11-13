import { CLAY_DATASET_SCHEMA } from "../../src/vision/dataset/types";

type Row = Record<string, unknown>;
export type ReviewedDataset = { exampleCount: number; sessionGroups: string[]; exampleIds: string[] };

function record(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value as Row;
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Validate run lengths without allocating an image-sized buffer.
function maskForeground(value: unknown, pixels: number): number {
  const mask = record(value);
  if (mask.encoding !== "value-runs-v1" || !Array.isArray(mask.runs) || mask.runs.length % 2 !== 0)
    throw new Error("Unsupported or malformed mask encoding");
  let total = 0;
  let foreground = 0;
  for (let i = 0; i < mask.runs.length; i += 2) {
    const bit: unknown = mask.runs[i];
    const count: unknown = mask.runs[i + 1];
    if ((bit !== 0 && bit !== 1) || typeof count !== "number" || !Number.isSafeInteger(count) || count <= 0)
      throw new Error("Mask runs require binary values and positive integer lengths");
    total += count;
    if (total > pixels) throw new Error("Mask runs exceed frame dimensions");
    if (bit === 1) foreground += count;
  }
  if (total !== pixels) throw new Error("Mask dimensions do not match the frame");
  return foreground;
}

/** Check annotation readiness, not license provenance, image decoding, or physical accuracy. */
export function validateReviewedDataset(text: string): ReviewedDataset {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => record(JSON.parse(line)));
  const manifest = rows[0];
  if (manifest?.schemaVersion !== CLAY_DATASET_SCHEMA || manifest.kind !== "manifest")
    throw new Error("The first row must be a clay-dataset-v1 manifest");
  const examples = rows.slice(1);
  if (examples.length === 0 || manifest.exampleCount !== examples.length)
    throw new Error("A nonempty dataset and matching manifest count are required");
  const ids = new Set<string>();
  const sessions = new Set<string>();
  for (const example of examples) {
    if (example.schemaVersion !== CLAY_DATASET_SCHEMA || example.kind !== undefined)
      throw new Error("Every example must use the dataset schema");
    if (!nonempty(example.id) || ids.has(example.id)) throw new Error("Example IDs must be nonempty and unique");
    if (!nonempty(example.sessionGroupId)) throw new Error("Every example needs a recording session group");
    if (!nonempty(example.segmentationVersion)) throw new Error("Every example needs a segmentation version");
    if (example.rights !== "tester-owned" && example.rights !== "licensed-external")
      throw new Error("Every example must declare capture rights");
    if (
      !nonempty(example.frameDataUrl) ||
      !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(example.frameDataUrl)
    )
      throw new Error("Every example needs an inline image, not a remote URL");
    const { width, height } = example;
    if (
      typeof width !== "number" ||
      typeof height !== "number" ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      !Number.isSafeInteger(width * height)
    )
      throw new Error("Invalid frame dimensions");
    const pixels = width * height;
    maskForeground(example.automaticMask, pixels);
    const corrected = example.correctedMask === null ? null : maskForeground(example.correctedMask, pixels);
    if (example.verdict === "correct" || example.verdict === "corrected") {
      if (corrected === null || corrected === 0) throw new Error("Clay examples require reviewed foreground masks");
    } else if (example.verdict === "no-clay") {
      if (corrected !== null && corrected !== 0) throw new Error("No-clay truth cannot contain foreground");
    } else {
      throw new Error("Unusable or unreviewed examples must be excluded before evaluation");
    }
    ids.add(example.id);
    sessions.add(example.sessionGroupId);
  }
  return { exampleCount: examples.length, sessionGroups: [...sessions].sort(), exampleIds: [...ids].sort() };
}

/** Reject shared sessions or repeated example identities across held-out and training exports. */
export function validateDatasetSplit(training: ReviewedDataset, evaluation: ReviewedDataset): void {
  const sessions = new Set(training.sessionGroups);
  const ids = new Set(training.exampleIds);
  if (evaluation.sessionGroups.some((id) => sessions.has(id)) || evaluation.exampleIds.some((id) => ids.has(id)))
    throw new Error("Training and evaluation exports overlap");
}
