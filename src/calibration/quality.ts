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
  wheelTooSmall: "WHEEL_TOO_SMALL",
  wheelImplausible: "WHEEL_IMPLAUSIBLE",
} as const;

const MIN_WHEEL_SPAN_FRACTION = 0.25;

/** Returns stable reason codes for every quality gate the calibration fails; empty means acceptable. */
export function validateCalibration(result: CalibrationResult): string[] {
  if (result.method === "wheel-head") return validateWheelHead(result);
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

function validateWheelHead(result: CalibrationResult): string[] {
  const reasons: string[] = [...(result.wheelViewPose?.reasons ?? [])];
  const wheel = result.wheelHead;
  const span = wheel ? wheel.rightX - wheel.leftX : 0;
  if (!wheel || span <= 0 || wheel.diameterMm <= 0 || wheel.leftX < 0 || wheel.rightX > result.roiImage.width) {
    reasons.push(CALIBRATION_REASON.wheelImplausible);
  } else if (span < result.roiImage.width * MIN_WHEEL_SPAN_FRACTION) {
    reasons.push(CALIBRATION_REASON.wheelTooSmall);
  }
  if (result.quality.estimatedErrorMm95 > 10) reasons.push(CALIBRATION_REASON.estimatedError);
  return reasons;
}
