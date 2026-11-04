import { passesClayModelGate, type ClaySegmentationMetrics } from "../../benchmarks/clay-segmentation/metrics";

export type ClayModelManifest = {
  schemaVersion: "clay-model-v1";
  modelVersion: string;
  datasetVersion: string;
  sha256: string;
  inputSize: [number, number];
  threshold: number;
  promoted: boolean;
  evaluation: ClaySegmentationMetrics;
};

export function validateClayModelManifest(value: ClayModelManifest): ClayModelManifest {
  if (value.schemaVersion !== "clay-model-v1") throw new Error("Unsupported clay model manifest");
  if (!value.modelVersion || !value.datasetVersion) throw new Error("Model and dataset versions are required");
  if (!/^[a-f\d]{64}$/i.test(value.sha256)) throw new Error("A 64-character SHA-256 checksum is required");
  if (value.inputSize.some((size) => !Number.isInteger(size) || size <= 0)) throw new Error("Invalid model input size");
  if (!(value.threshold > 0 && value.threshold < 1)) throw new Error("Model threshold must be between zero and one");
  if (value.promoted && !passesClayModelGate(value.evaluation))
    throw new Error("A promoted clay model must pass every held-out evaluation gate");
  return value;
}
