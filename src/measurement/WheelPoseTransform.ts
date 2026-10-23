import type { Point2 } from "../calibration/types";
import type { WheelViewPose } from "../calibration/wheelViewPose";

export type MeasurementTransform = {
  imageToWheel(point: Point2): { radialMm: number; verticalMm: number } | null;
  radiusAt(left: Point2, right: Point2, verticalMm: number): number | null;
  estimatedErrorMm95At(point: Point2): number;
};

/** Creates the deterministic weak-perspective transform used by the measurement worker. */
export function createWheelPoseTransform(pose: WheelViewPose): MeasurementTransform {
  const verticalProjection = Math.sin(pose.downwardAngleRad);
  const verticalScale = pose.wheelPlaneMmPerMajorPixel / Math.max(0.1, verticalProjection);
  const dot = (point: Point2, axis: Point2) =>
    (point.x - pose.wheelCenterImage.x) * axis.x + (point.y - pose.wheelCenterImage.y) * axis.y;
  const inRegion = (point: Point2) => {
    const region = pose.supportedRegionImage;
    const onBaseline =
      Math.abs(point.x - pose.wheelCenterImage.x) < 0.001 && Math.abs(point.y - pose.wheelCenterImage.y) < 0.001;
    return (
      onBaseline ||
      (point.x >= region.x &&
        point.x <= region.x + region.width &&
        point.y >= region.y &&
        point.y <= region.y + region.height)
    );
  };
  return {
    imageToWheel(point) {
      if (!inRegion(point)) return null;
      return {
        radialMm: dot(point, pose.majorAxisImage) * pose.wheelPlaneMmPerMajorPixel,
        verticalMm: dot(point, pose.projectedVerticalImage) * verticalScale,
      };
    },
    radiusAt(left, right) {
      const span = Math.abs((right.x - left.x) * pose.majorAxisImage.x + (right.y - left.y) * pose.majorAxisImage.y);
      return (span * pose.wheelPlaneMmPerMajorPixel) / 2;
    },
    estimatedErrorMm95At(point) {
      const heightMm = Math.abs(dot(point, pose.projectedVerticalImage) * verticalScale);
      return pose.estimatedErrorMm95 + heightMm * (1 - pose.confidence) * 0.1;
    },
  };
}
