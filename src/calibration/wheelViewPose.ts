import type { Point2 } from "./types";
import { canonicalWheelEllipse, type WheelEllipse } from "./wheelEllipse";

export type WheelViewPose = {
  wheelCenterImage: Point2;
  majorAxisImage: Point2;
  minorAxisImage: Point2;
  projectedVerticalImage: Point2;
  downwardAngleRad: number;
  wheelPlaneMmPerMajorPixel: number;
  supportedRegionImage: { x: number; y: number; width: number; height: number };
  estimatedErrorMm95: number;
  confidence: number;
  reasons: string[];
};

const MIN_WORKING_HEIGHT_FRACTION = 0.35;
const MIN_VISIBLE_ARC = 0.75;
const MIN_DOWNWARD_ANGLE_RAD = (15 * Math.PI) / 180;
const MAX_DOWNWARD_ANGLE_RAD = (75 * Math.PI) / 180;
const MAX_ROLL_RAD = (12 * Math.PI) / 180;

/** Derives a weak-perspective view pose from a circular wheel's observed ellipse. */
export function deriveWheelViewPose(
  input: WheelEllipse,
  diameterMm: number,
  frame: { width: number; height: number },
): WheelViewPose {
  const ellipse = canonicalWheelEllipse(input);
  const ratio = clamp(ellipse.radiusMinor / ellipse.radiusMajor, 0, 1);
  const angle = Math.acos(ratio);
  const majorAxisImage = unit(ellipse.rotationRad);
  const minorAxisImage = { x: -majorAxisImage.y, y: majorAxisImage.x };
  const projectedVerticalImage =
    minorAxisImage.y >= 0 ? { x: -minorAxisImage.x, y: -minorAxisImage.y } : minorAxisImage;
  const wheelTop = Math.max(0, ellipse.centerY - ellipse.radiusMinor);
  const region = { x: 0, y: 0, width: frame.width, height: wheelTop };
  const reasons: string[] = [];
  if (ellipse.visibleArcFraction < MIN_VISIBLE_ARC) reasons.push("WHEEL_RIM_INCOMPLETE");
  if (region.height < frame.height * MIN_WORKING_HEIGHT_FRACTION) reasons.push("WORKING_REGION_CLIPPED");
  if (angle < MIN_DOWNWARD_ANGLE_RAD) reasons.push("VIEW_TOO_SHALLOW");
  if (angle > MAX_DOWNWARD_ANGLE_RAD) reasons.push("VIEW_TOO_STEEP");
  if (Math.min(ellipse.rotationRad, Math.PI - ellipse.rotationRad) > MAX_ROLL_RAD) reasons.push("VIEW_OFF_AXIS");
  const scale = diameterMm / (2 * ellipse.radiusMajor);
  const residualMm = ellipse.fitResidualPx95 * scale;
  const coveragePenalty = (1 - ellipse.visibleArcFraction) * diameterMm * 0.1;
  return {
    wheelCenterImage: { x: ellipse.centerX, y: ellipse.centerY },
    majorAxisImage,
    minorAxisImage,
    projectedVerticalImage,
    downwardAngleRad: angle,
    wheelPlaneMmPerMajorPixel: scale,
    supportedRegionImage: region,
    estimatedErrorMm95: residualMm + coveragePenalty,
    confidence: Math.min(ellipse.confidence, ellipse.visibleArcFraction) * Math.exp(-ellipse.fitResidualPx95 / 10),
    reasons,
  };
}

function unit(angle: number): Point2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
