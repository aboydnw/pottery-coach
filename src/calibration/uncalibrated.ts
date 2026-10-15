import { BOARD_V1 } from "./boardV1";
import type { CalibrationResult } from "./types";

/**
 * A placeholder calibration for shape-only sessions. The worker measures in pixels, so outlines and
 * proportions are meaningful but any "mm" value is not; callers must not show or store sizes.
 */
export function uncalibratedCalibration(width: number, height: number): CalibrationResult {
  return {
    id: "uncalibrated",
    method: "none",
    createdAtMs: Date.now(),
    status: "accepted",
    homographyImageToMm: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    wheelBaseline: [...BOARD_V1.calibration.wheelBaseline],
    wheelCenterlineXmm: BOARD_V1.calibration.wheelCenterlineXmm,
    roiImage: { x: 0, y: 0, width, height },
    markerPlaneOffsetToleranceMm: BOARD_V1.calibration.markerPlaneOffsetToleranceMm,
    quality: {
      tagCount: 0,
      reprojectionErrorPx95: 0,
      scaleVariationFraction: 0,
      estimatedErrorMm95: 0,
      poseYawDeg: null,
      posePitchDeg: null,
      blurScore: 1,
      contrastScore: 1,
    },
    reasons: ["UNCALIBRATED_SHAPE_ONLY"],
    provenance: "manual-assisted",
    boardRevision: BOARD_V1.revision,
    supportedBoardRevision: BOARD_V1.revision,
    roiClipped: false,
  };
}
