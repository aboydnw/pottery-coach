export type ConfidenceComponent = { score: number; reasons: string[] };
export type MeasurementConfidence = {
  overall: number;
  calibration: ConfidenceComponent;
  segmentation: ConfidenceComponent;
  occlusion: ConfidenceComponent;
  temporalStability: ConfidenceComponent;
  freshnessMs: number;
  estimatedErrorMm95: number | null;
};
export type ProfileSample = { heightRatio: number; radiusMm: number | null; confidence: number };
export type DimensionReading = {
  id: string; timestampMs: number; sourceFrameId: number; calibrationId: string;
  heightMm: number | null; maximumWidthMm: number | null; rimWidthMm: number | null;
  baseWidthMm: number | null; centerlineOffsetMm: number | null; profile: ProfileSample[];
  visibleAsymmetryMm: number | null; confidence: MeasurementConfidence;
};
export type StableDimensionReading = DimensionReading & {
  windowStartMs: number; contributingFrameCount: number; lastReliableTimestampMs: number | null;
};
