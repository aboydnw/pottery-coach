import type { CalibrationResult } from "../calibration/types";
import type { StableDimensionReading } from "../measurement/types";
import { BOARD_V1 } from "../calibration/boardV1";

/** A deterministic, already-accepted calibration for demo and end-to-end test sessions. */
export function demoCalibration(width = 640, height = 360): CalibrationResult {
  return {
    id: "demo-calibration",
    method: "board",
    createdAtMs: Date.now(),
    status: "accepted",
    homographyImageToMm: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    wheelBaseline: [...BOARD_V1.calibration.wheelBaseline],
    wheelCenterlineXmm: BOARD_V1.calibration.wheelCenterlineXmm,
    roiImage: { x: 0, y: 0, width, height },
    markerPlaneOffsetToleranceMm: BOARD_V1.calibration.markerPlaneOffsetToleranceMm,
    quality: {
      tagCount: 4,
      reprojectionErrorPx95: 0.2,
      scaleVariationFraction: 0.005,
      estimatedErrorMm95: 2,
      poseYawDeg: 0,
      posePitchDeg: 0,
      blurScore: 1,
      contrastScore: 1,
    },
    reasons: [],
    provenance: "automatic",
    boardRevision: BOARD_V1.revision,
    supportedBoardRevision: BOARD_V1.revision,
    roiClipped: false,
  };
}

/** A deterministic 120 mm cylinder reading that matches the demo calibration. */
export function demoReading(nowMs = Date.now()): StableDimensionReading {
  const component = { score: 0.95, reasons: [] };
  return {
    id: "demo-reading-1",
    timestampMs: nowMs,
    sourceFrameId: 1,
    calibrationId: "demo-calibration",
    heightMm: 120,
    maximumWidthMm: 92,
    rimWidthMm: 78,
    baseWidthMm: 70,
    centerlineOffsetMm: 1,
    visibleAsymmetryMm: 2,
    profile: Array.from({ length: 64 }, (_, index) => ({
      heightRatio: index / 63,
      radiusMm: 35 + index * 0.18,
      confidence: 0.95,
    })),
    confidence: {
      overall: 0.95,
      calibration: component,
      segmentation: component,
      occlusion: component,
      temporalStability: component,
      freshnessMs: 0,
      estimatedErrorMm95: 2,
    },
    windowStartMs: nowMs - 500,
    contributingFrameCount: 5,
    lastReliableTimestampMs: nowMs,
  };
}
