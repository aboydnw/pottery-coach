import { expect, it } from "vitest";
import type { WheelViewPose } from "../calibration/wheelViewPose";
import { createWheelPoseTransform } from "./WheelPoseTransform";

const pose: WheelViewPose = {
  wheelCenterImage: { x: 320, y: 400 },
  majorAxisImage: { x: 1, y: 0 },
  minorAxisImage: { x: 0, y: 1 },
  projectedVerticalImage: { x: 0, y: -1 },
  downwardAngleRad: Math.PI / 3,
  wheelPlaneMmPerMajorPixel: 1,
  supportedRegionImage: { x: 0, y: 0, width: 640, height: 325 },
  estimatedErrorMm95: 2,
  confidence: 0.95,
  reasons: [],
};

it("maps projected vessel height into wheel-centred millimetres", () => {
  const transform = createWheelPoseTransform(pose);
  expect(transform.imageToWheel({ x: 320, y: 400 })).toEqual({ radialMm: 0, verticalMm: 0 });
  expect(transform.imageToWheel({ x: 320, y: 400 - 100 * Math.sin(Math.PI / 3) })?.verticalMm).toBeCloseTo(100);
});

it("estimates rotationally symmetric radius from two silhouette boundaries", () => {
  const transform = createWheelPoseTransform(pose);
  expect(transform.radiusAt({ x: 270, y: 300 }, { x: 370, y: 300 }, 100)).toBeCloseTo(50);
});

it("refuses image points outside the supported vessel region", () => {
  expect(createWheelPoseTransform(pose).imageToWheel({ x: 320, y: 390 })).toBeNull();
});

it("increases uncertainty farther from the calibrated wheel plane", () => {
  const transform = createWheelPoseTransform(pose);
  expect(transform.estimatedErrorMm95At({ x: 320, y: 200 })).toBeGreaterThan(
    transform.estimatedErrorMm95At({ x: 320, y: 390 }),
  );
});
