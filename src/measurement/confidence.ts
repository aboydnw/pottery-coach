import type { ConfidenceComponent, MeasurementConfidence } from "./types";

type ConfidenceInputs = {
  calibration: ConfidenceComponent;
  segmentation: ConfidenceComponent;
  occlusion: ConfidenceComponent;
  temporalStability: ConfidenceComponent;
  capturedAtMs: number;
  nowMs: number;
  calibrationErrorMm95: number | null;
  segmentationErrorMm95: number | null;
};

export function scoreConfidence(inputs: ConfidenceInputs): MeasurementConfidence {
  const criticalScores = [
    inputs.calibration.score,
    inputs.segmentation.score,
    inputs.occlusion.score,
    inputs.temporalStability.score,
  ];
  const errors = [inputs.calibrationErrorMm95, inputs.segmentationErrorMm95]
    .filter((value): value is number => value !== null);
  return {
    overall: Math.max(0, Math.min(1, Math.min(...criticalScores))),
    calibration: inputs.calibration,
    segmentation: inputs.segmentation,
    occlusion: inputs.occlusion,
    temporalStability: inputs.temporalStability,
    freshnessMs: Math.max(0, inputs.nowMs - inputs.capturedAtMs),
    estimatedErrorMm95: errors.length === 0 ? null : errors.reduce((sum, value) => sum + value, 0),
  };
}
