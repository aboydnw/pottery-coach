import { expect, it } from "vitest";
import type { WheelEllipse } from "./wheelEllipse";
import { deriveWheelViewPose } from "./wheelViewPose";

const ellipse = (centerX = 320, centerY = 350): WheelEllipse => ({
  centerX,
  centerY,
  radiusMajor: 150,
  radiusMinor: 75,
  rotationRad: 0,
  fitResidualPx95: 0.5,
  visibleArcFraction: 1,
  confidence: 0.95,
});

it("derives downward angle and wheel-plane scale from a known circle", () => {
  const pose = deriveWheelViewPose(ellipse(), 300, { width: 640, height: 480 });
  expect(pose.downwardAngleRad).toBeCloseTo(Math.acos(0.5));
  expect(pose.wheelPlaneMmPerMajorPixel).toBeCloseTo(1);
  expect(pose.majorAxisImage).toEqual({ x: 1, y: 0 });
  expect(pose.reasons).toEqual([]);
});

it("rejects a clipped working region instead of accepting geometry", () => {
  const pose = deriveWheelViewPose(ellipse(320, 110), 300, { width: 640, height: 480 });
  expect(pose.reasons).toContain("WORKING_REGION_CLIPPED");
});

it("propagates fit and coverage uncertainty into confidence", () => {
  const pose = deriveWheelViewPose({ ...ellipse(), fitResidualPx95: 8, visibleArcFraction: 0.5 }, 300, {
    width: 640,
    height: 480,
  });
  expect(pose.reasons).toContain("WHEEL_RIM_INCOMPLETE");
  expect(pose.confidence).toBeLessThan(0.5);
  expect(pose.estimatedErrorMm95).toBeGreaterThan(8);
});
