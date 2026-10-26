import { expect, it } from "vitest";

import type { CalibrationResult } from "./types";
import {
  BoardCalibrationAccumulator,
  boardPoseFromCalibration,
  validateWheelDiameterCrossCheck,
} from "./boardCalibration";

function calibration(overrides: Partial<CalibrationResult> = {}): CalibrationResult {
  return {
    id: "board-1",
    method: "board",
    createdAtMs: 0,
    status: "accepted",
    homographyImageToMm: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    wheelBaseline: [
      { x: 45, y: 120 },
      { x: 165, y: 120 },
    ],
    wheelCenterlineXmm: 105,
    roiImage: { x: 0, y: 0, width: 640, height: 480 },
    markerPlaneOffsetToleranceMm: 30,
    quality: {
      tagCount: 4,
      reprojectionErrorPx95: 0.2,
      scaleVariationFraction: 0.001,
      estimatedErrorMm95: 2,
      poseYawDeg: null,
      posePitchDeg: null,
      blurScore: 1,
      contrastScore: 1,
    },
    reasons: [],
    provenance: "automatic",
    boardRevision: "board-v1",
    supportedBoardRevision: "board-v1",
    roiClipped: false,
    ...overrides,
  };
}

it("maps the board center back to the wheel center in image pixels", () => {
  const pose = boardPoseFromCalibration(calibration(), 350);
  expect(pose.wheelCenterImage.x).toBeCloseTo(105);
  expect(pose.wheelCenterImage.y).toBeCloseTo(74);
  expect(pose.wheelDiameterMm).toBe(350);
});

it("accepts five consistent observations spanning 500 ms", () => {
  const accumulator = new BoardCalibrationAccumulator();
  for (let index = 0; index < 5; index += 1) {
    accumulator.add({
      capturedAtMs: index * 125,
      result: calibration({
        id: `board-${index}`,
        homographyImageToMm: [1, 0, -index * 0.1, 0, 1, 0, 0, 0, 1],
      }),
    });
  }
  expect(accumulator.result()?.status).toBe("accepted");
});

it("does not accept observations that move too far", () => {
  const accumulator = new BoardCalibrationAccumulator();
  for (let index = 0; index < 5; index += 1) {
    accumulator.add({
      capturedAtMs: index * 125,
      result: calibration({ homographyImageToMm: [1, 0, -index * 3, 0, 1, 0, 0, 0, 1] }),
    });
  }
  expect(accumulator.result()).toBeNull();
});

it("rejects an entered wheel diameter that differs from an independently detected rim by more than ten percent", () => {
  const result = calibration({ boardPose: boardPoseFromCalibration(calibration(), 350, 350) });
  expect(validateWheelDiameterCrossCheck(result, 250)).toContain("DIAMETER_MISMATCH");
  expect(validateWheelDiameterCrossCheck(result, 340)).toEqual([]);
});
