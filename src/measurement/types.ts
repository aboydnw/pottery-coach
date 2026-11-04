/** Readings are measured in full-resolution camera pixels until a session scale converts them to millimetres. */
export type LengthUnit = "px" | "mm";

export type ConfidenceComponent = { score: number; reasons: string[] };
export type MeasurementConfidence = {
  overall: number;
  calibration: ConfidenceComponent;
  segmentation: ConfidenceComponent;
  occlusion: ConfidenceComponent;
  temporalStability: ConfidenceComponent;
  freshnessMs: number;
  /** 95th-percentile error estimate, in the reading's unit. */
  estimatedError95: number | null;
};
export type ProfileSample = { heightRatio: number; radius: number | null; confidence: number };
export type DimensionReading = {
  id: string;
  timestampMs: number;
  sourceFrameId: number;
  calibrationId: string;
  unit: LengthUnit;
  height: number | null;
  maximumWidth: number | null;
  rimWidth: number | null;
  baseWidth: number | null;
  centerlineOffset: number | null;
  profile: ProfileSample[];
  visibleAsymmetry: number | null;
  /**
   * How far the top third's centre sits from the base's centre, in image x (positive = image right).
   * A steady lean means one side is bulging out more than the other.
   */
  leanOffset?: number | null;
  /** True when hands are probably on the pot, so the outline isn't the pot alone. */
  handsLikely?: boolean;
  /** Versioned provider that supplied the clay mask for this reading. */
  segmentationVersion?: string;
  confidence: MeasurementConfidence;
};
export type StableDimensionReading = DimensionReading & {
  windowStartMs: number;
  contributingFrameCount: number;
  lastReliableTimestampMs: number | null;
};
