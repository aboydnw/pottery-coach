import { CLAY_DATASET_SCHEMA, type ClayDatasetExampleV1 } from "./types";

export function exportDataset(examples: ClayDatasetExampleV1[]): Blob {
  for (const example of examples)
    if (example.schemaVersion !== CLAY_DATASET_SCHEMA) throw new Error("Unsupported clay dataset version");
  const manifest = {
    schemaVersion: CLAY_DATASET_SCHEMA,
    kind: "manifest",
    exampleCount: examples.length,
    privacy: "explicit-local-export",
  };
  const lines = [manifest, ...examples].map((value) => JSON.stringify(value)).join("\n") + "\n";
  return new Blob([lines], { type: "application/x-ndjson" });
}
