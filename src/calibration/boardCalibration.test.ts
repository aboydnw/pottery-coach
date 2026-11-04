import { expect, it } from "vitest";
import { BOARD_V1, tagCornersMm } from "./boardV1";
import { solveCalibration } from "./homography";
import { validateCalibration } from "./quality";
import { createWheelPoseTransform } from "../measurement/WheelPoseTransform";
import { scaleFromCalibration } from "../measurement/scale";

import type { CalibrationResult } from "./types";
import {
  BoardCalibrationAccumulator,
  boardPoseFromCalibration,
  validateWheelDiameterCrossCheck,
  wheelViewPoseFromBoardCalibration,
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

it("derives a weak-perspective vessel transform from the flat board axes", () => {
  const result = calibration({ homographyImageToMm: [1, 0, 0, 0, 2, 0, 0, 0, 1] });
  const pose = wheelViewPoseFromBoardCalibration(result);
  expect(pose.wheelPlaneMmPerMajorPixel).toBeCloseTo(1);
  expect(pose.downwardAngleRad).toBeCloseTo(Math.acos(0.5));
  expect(pose.projectedVerticalImage.y).toBeLessThan(0);
});

function projectedBoard(project: (point: { x: number; y: number }) => { x: number; y: number }) {
  const result = solveCalibration(
    BOARD_V1.tags.flatMap((tag) =>
      tagCornersMm(tag.id)!.map((boardMm) => ({ tagId: tag.id, boardMm, image: project(boardMm) })),
    ),
    BOARD_V1.calibration,
    {
      boardPlacement: "wheel-plane",
      width: 1280,
      height: 960,
      roi: { x: 0, y: 0, width: 1280, height: 960 },
      poseYawDeg: null,
      posePitchDeg: null,
      blurScore: 1,
      contrastScore: 1,
    },
  );
  result.wheelViewPose = wheelViewPoseFromBoardCalibration(result);
  result.reasons = validateCalibration(result);
  result.status = result.reasons.length ? "rejected" : "accepted";
  return result;
}

it.each([500, 1000, 2000])(
  "accepts normal perspective of a flat board at %i mm without treating it as print distortion",
  (distance) => {
    for (const angleDeg of [30, 45, 60]) {
      const angle = (angleDeg * Math.PI) / 180;
      const result = projectedBoard(({ x, y }) => {
        x -= 105;
        y -= 74;
        const depth = distance - y * Math.cos(angle);
        return { x: 640 + (800 * x) / depth, y: 650 + (800 * y * Math.sin(angle)) / depth };
      });
      expect(result.quality.scaleVariationFraction).toBeGreaterThan(0.02);
      expect(result.quality.reprojectionErrorPx95).toBeLessThan(0.001);
      expect(result.reasons).toEqual([]);
      expect(result.wheelViewPose?.metricUnsupportedReason).toBe("BOARD_PERSPECTIVE_UNSUPPORTED");
      expect(scaleFromCalibration(result)).toBeNull();
      // A valid plane homography is not proof of off-plane vessel accuracy. In the closest 45°
      // view a true 200 mm height used to become ~279 mm with an error estimate below 3 mm.
      const vesselHeight = 200;
      const vesselDepth = distance - vesselHeight * Math.sin(angle);
      const vesselTop = { x: 640, y: 650 - (800 * vesselHeight * Math.cos(angle)) / vesselDepth };
      const transform = createWheelPoseTransform(result.wheelViewPose!);
      expect(transform.imageToWheel(vesselTop)).toBeNull();
      expect(transform.radiusAt({ x: 500, y: 600 }, { x: 780, y: 600 }, 50)).toBeNull();
      expect(transform.estimatedErrorMm95At(vesselTop)).toBe(Number.POSITIVE_INFINITY);

      const accumulator = new BoardCalibrationAccumulator();
      for (let index = 0; index < 5; index += 1) accumulator.add({ capturedAtMs: index * 125, result });
      expect(accumulator.result()?.status).toBe("accepted");
    }
  },
);

it.each([0, 15, 30, 45, 90, 135, 180])(
  "keeps vessel dimensions independent of %i degree page rotation",
  (rotationDeg) => {
    const angle = (rotationDeg * Math.PI) / 180;
    const result = projectedBoard(({ x, y }) => {
      x -= 105;
      y -= 74;
      return {
        x: 640 + Math.cos(angle) * x - Math.sin(angle) * y,
        y: 650 + 0.5 * (Math.sin(angle) * x + Math.cos(angle) * y),
      };
    });
    const pose = result.wheelViewPose!;
    const transform = createWheelPoseTransform(pose);
    expect(result.reasons).toEqual([]);
    expect(pose.wheelPlaneMmPerMajorPixel).toBeCloseTo(1);
    expect(pose.downwardAngleRad).toBeCloseTo(Math.acos(0.5));
    expect(transform.imageToWheel({ x: 640, y: 650 - 100 * Math.sqrt(0.75) })?.verticalMm).toBeCloseTo(100);
    expect(2 * transform.radiusAt({ x: 590, y: 600 }, { x: 690, y: 600 }, 0)!).toBeCloseTo(100);
    expect(boardPoseFromCalibration(result, 350).projectedVerticalImage).toEqual(pose.projectedVerticalImage);
  },
);

it("does not let the wheel-plane calibration bypass unsupported camera views", () => {
  const result = projectedBoard(({ x, y }) => ({ x: 640 + x - 105, y: 650 + y - 74 }));
  expect(result.status).toBe("rejected");
  expect(result.reasons).toContain("VIEW_TOO_SHALLOW");
});
