export const CLAY_DATASET_SCHEMA = "clay-dataset-v1" as const;

export type ReviewVerdict = "correct" | "corrected" | "no-clay" | "unusable";
export type CaptureCondition =
  "dry-clay" | "wet-clay" | "hands" | "tools" | "bat" | "glare" | "low-light" | "empty-wheel";
export type CaptureRights = "tester-owned" | "licensed-external";

export type EncodedMask = { encoding: "value-runs-v1"; runs: number[] };

export type ClayDatasetExampleV1 = {
  schemaVersion: typeof CLAY_DATASET_SCHEMA;
  id: string;
  sessionGroupId: string;
  frameDataUrl: string;
  width: number;
  height: number;
  automaticMask: EncodedMask;
  correctedMask: EncodedMask | null;
  verdict: ReviewVerdict;
  calibrationId: string;
  wheelDiameterMm: number;
  segmentationVersion: string;
  conditions: CaptureCondition[];
  rights: CaptureRights;
};

export type ClayDatasetExampleInput = Omit<
  ClayDatasetExampleV1,
  "schemaVersion" | "id" | "automaticMask" | "correctedMask" | "conditions"
> & {
  automaticMask: Uint8Array;
  correctedMask: Uint8Array | null;
  conditions: readonly CaptureCondition[];
};
