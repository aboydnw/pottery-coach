import type { CalibrationResult } from "./types";

export const CALIBRATION_REASON = {
  tagCount: "TAG_COUNT",
  reprojection: "REPROJECTION_ERROR",
  scaleVariation: "SCALE_VARIATION",
  estimatedError: "ESTIMATED_ERROR",
  poseYaw: "POSE_YAW",
  posePitch: "POSE_PITCH",
  roiClipped: "ROI_CLIPPED",
  boardRevision: "BOARD_REVISION",
  blur: "BLUR",
  contrast: "CONTRAST",
} as const;

export function validateCalibration(result: CalibrationResult): string[] {
  const reasons: string[] = [];
  const quality = result.quality;
  if (quality.tagCount < 3) reasons.push(CALIBRATION_REASON.tagCount);
  if (quality.reprojectionErrorPx95 > 1.5) reasons.push(CALIBRATION_REASON.reprojection);
  if (quality.scaleVariationFraction > 0.02) reasons.push(CALIBRATION_REASON.scaleVariation);
  if (quality.estimatedErrorMm95 > 10) reasons.push(CALIBRATION_REASON.estimatedError);
  if (quality.poseYawDeg !== null && Math.abs(quality.poseYawDeg) > 8) reasons.push(CALIBRATION_REASON.poseYaw);
  if (quality.posePitchDeg !== null && Math.abs(quality.posePitchDeg) > 8) reasons.push(CALIBRATION_REASON.posePitch);
  if (result.roiClipped) reasons.push(CALIBRATION_REASON.roiClipped);
  if (result.boardRevision !== result.supportedBoardRevision) reasons.push(CALIBRATION_REASON.boardRevision);
  if (quality.blurScore < 0.25) reasons.push(CALIBRATION_REASON.blur);
  if (quality.contrastScore < 0.25) reasons.push(CALIBRATION_REASON.contrast);
  return reasons;
}
