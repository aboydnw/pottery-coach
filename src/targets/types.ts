import type { MeasurementConfidence } from "../measurement/types";

export type TargetSource = "curated-template" | "reference-image" | "manual-trace";
export type TargetProfile = {
  id: string; name: string; revision: number;
  normalizedRadiusByHeight: Array<{ heightRatio: number; radiusToHeightRatio: number }>;
  intendedWetHeightMm: number; shrinkageFraction: number | null; source: TargetSource;
  confidence: number; exclusions: string[]; provenance: string;
  generator: { kind: "linear"; bottomRadiusRatio: number; topRadiusRatio: number };
};
export type ProfileRegion = "base" | "lower-body" | "upper-body" | "rim";
export type RegionalProfileError = { region: ProfileRegion; signedMedianRadiusErrorMm: number | null; meanAbsoluteRadiusErrorMm: number | null; coverage: number; confidence: number };
export type ProfileComparison = { id: string; timestampMs: number; readingId: string; targetId: string; meanAbsoluteRadiusErrorMm: number | null; normalizedSilhouetteIoU: number | null; regions: RegionalProfileError[]; confidence: MeasurementConfidence };
