import { describe, expect, it } from "vitest";

import { applyHomography, solveCalibration } from "./homography";
import type { CalibrationBoard, CalibrationFrame, PointCorrespondence } from "./types";

const board: CalibrationBoard = {
  revision: "board-v1",
  supportedRevision: "board-v1",
  wheelBaseline: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  wheelCenterlineXmm: 50,
  markerPlaneOffsetToleranceMm: 30,
};

const frame: CalibrationFrame = {
  width: 1280,
  height: 720,
  roi: { x: 100, y: 50, width: 900, height: 600 },
  poseYawDeg: 0,
  posePitchDeg: 0,
  blurScore: 1,
  contrastScore: 1,
};

describe("solveCalibration", () => {
  it("recovers board coordinates from a known projective transform", () => {
    const imageToMm = [0.2, 0.01, -20, -0.005, 0.18, -8, 0.0001, -0.00005, 1] as const;
    const imagePoints = [
      { x: 120, y: 80 },
      { x: 920, y: 70 },
      { x: 900, y: 620 },
      { x: 130, y: 610 },
      { x: 500, y: 350 },
    ];
    const correspondences: PointCorrespondence[] = imagePoints.map((image) => ({
      image,
      boardMm: applyHomography(imageToMm, image),
    }));

    const result = solveCalibration(correspondences, board, frame);

    for (const point of correspondences) {
      const recovered = applyHomography(result.homographyImageToMm, point.image);
      expect(Math.hypot(recovered.x - point.boardMm.x, recovered.y - point.boardMm.y)).toBeLessThanOrEqual(0.25);
    }
  });

  it("rejects collinear correspondences", () => {
    const correspondences: PointCorrespondence[] = [0, 1, 2, 3].map((value) => ({
      image: { x: value, y: value },
      boardMm: { x: value * 10, y: value * 10 },
    }));

    expect(() => solveCalibration(correspondences, board, frame)).toThrow(/degenerate/i);
  });
});
