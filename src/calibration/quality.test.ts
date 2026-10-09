import { describe, expect, it } from "vitest";

import { validateCalibration } from "./quality";
import type { CalibrationResult } from "./types";

function acceptedResult(): CalibrationResult {
  return {
    id: "calibration-1",
    createdAtMs: 1,
    status: "accepted",
    homographyImageToMm: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    wheelBaseline: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    wheelCenterlineXmm: 50,
    roiImage: { x: 1, y: 1, width: 100, height: 100 },
    markerPlaneOffsetToleranceMm: 30,
    quality: {
      tagCount: 4,
      reprojectionErrorPx95: 1,
      scaleVariationFraction: 0.01,
      estimatedErrorMm95: 5,
      poseYawDeg: 0,
      posePitchDeg: 0,
      blurScore: 1,
      contrastScore: 1,
    },
    reasons: [],
    provenance: "automatic",
    boardRevision: "board-v1",
    supportedBoardRevision: "board-v1",
    roiClipped: false,
  };
}

describe("validateCalibration", () => {
  it.each([
    ["pose yaw", (result: CalibrationResult) => { result.quality.poseYawDeg = 9; }, "POSE_YAW"],
    ["scale variation", (result: CalibrationResult) => { result.quality.scaleVariationFraction = 0.021; }, "SCALE_VARIATION"],
    ["reprojection residual", (result: CalibrationResult) => { result.quality.reprojectionErrorPx95 = 1.6; }, "REPROJECTION_ERROR"],
    ["clipped ROI", (result: CalibrationResult) => { result.roiClipped = true; }, "ROI_CLIPPED"],
    ["wrong revision", (result: CalibrationResult) => { result.boardRevision = "board-v0"; }, "BOARD_REVISION"],
  ])("rejects %s with a stable reason code", (_name, mutate, reason) => {
    const result = acceptedResult();
    mutate(result);

    expect(validateCalibration(result)).toContain(reason);
  });
});
