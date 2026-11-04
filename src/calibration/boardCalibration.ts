import { BOARD_V1 } from "./boardV1";
import { applyHomography } from "./homography";
import type { BoardPose, CalibrationResult, Point2 } from "./types";
import type { WheelViewPose } from "./wheelViewPose";

export type CalibrationObservation = { capturedAtMs: number; result: CalibrationResult };

const REQUIRED_OBSERVATIONS = 5;
const REQUIRED_SPAN_MS = 500;
const MAX_CENTER_DRIFT_PX = 2;
const MAX_SCALE_VARIATION = 0.02;

export function boardPoseFromCalibration(
  result: CalibrationResult,
  wheelDiameterMm: number,
  detectedWheelDiameterMm?: number,
): BoardPose {
  const imageFromBoard = invert(result.homographyImageToMm);
  const centerBoard = { x: BOARD_V1.widthMm / 2, y: BOARD_V1.heightMm / 2 };
  const center = applyHomography(imageFromBoard, centerBoard);
  const { projectedVerticalImage } = wheelViewPoseFromBoardCalibration(result);
  return {
    boardRevision: "board-v1",
    wheelCenterImage: center,
    projectedVerticalImage,
    supportedRegionImage: result.roiImage,
    wheelDiameterMm,
    ...(detectedWheelDiameterMm === undefined ? {} : { detectedWheelDiameterMm }),
    estimatedErrorMm95: result.quality.estimatedErrorMm95,
  };
}

/**
 * Uses the principal axes of the local board-to-image Jacobian, not the printed page axes, so
 * turning the page on the wheel does not change the inferred scale or camera tilt. This is a
 * weak-perspective pose, not full camera-intrinsic recovery, so the physical device gate remains
 * authoritative for the error bound.
 */
export function wheelViewPoseFromBoardCalibration(result: CalibrationResult): WheelViewPose {
  const imageFromBoard = invert(result.homographyImageToMm);
  const centerBoard = { x: BOARD_V1.widthMm / 2, y: BOARD_V1.heightMm / 2 };
  const center = applyHomography(imageFromBoard, centerBoard);
  const denominator = imageFromBoard[6] * centerBoard.x + imageFromBoard[7] * centerBoard.y + imageFromBoard[8];
  // Reject a projective horizon crossing the printed page rather than accepting an invalid plane.
  for (const x of [0, BOARD_V1.widthMm]) {
    for (const y of [0, BOARD_V1.heightMm]) {
      const cornerDenominator = imageFromBoard[6] * x + imageFromBoard[7] * y + imageFromBoard[8];
      if (!Number.isFinite(cornerDenominator) || cornerDenominator * denominator <= 0)
        throw new Error("The printed page crosses the camera plane");
    }
  }
  const a = (imageFromBoard[0] - center.x * imageFromBoard[6]) / denominator;
  const b = (imageFromBoard[1] - center.x * imageFromBoard[7]) / denominator;
  const c = (imageFromBoard[3] - center.y * imageFromBoard[6]) / denominator;
  const d = (imageFromBoard[4] - center.y * imageFromBoard[7]) / denominator;
  // Eigenvectors of J Jᵀ give image axes; square-root eigenvalues give pixels per millimetre.
  const xx = a * a + b * b;
  const xy = a * c + b * d;
  const yy = c * c + d * d;
  const discriminant = Math.hypot(xx - yy, 2 * xy);
  const majorScale = Math.sqrt((xx + yy + discriminant) / 2);
  const minorScale = Math.sqrt(Math.max(0, (xx + yy - discriminant) / 2));
  if (!Number.isFinite(majorScale) || minorScale < 1e-6)
    throw new Error("Board axes are too small to derive camera pose");
  const rotation = Math.atan2(2 * xy, xx - yy) / 2;
  const majorAxisImage = { x: Math.cos(rotation), y: Math.sin(rotation) };
  const minorAxisImage = { x: -majorAxisImage.y, y: majorAxisImage.x };
  const projectedVerticalImage =
    minorAxisImage.y >= 0 ? { x: -minorAxisImage.x, y: -minorAxisImage.y } : minorAxisImage;
  const downwardAngleRad = Math.acos(clamp(minorScale / majorScale, 0, 1));
  const reasons: string[] = [];
  if (downwardAngleRad < (15 * Math.PI) / 180) reasons.push("VIEW_TOO_SHALLOW");
  if (downwardAngleRad > (75 * Math.PI) / 180) reasons.push("VIEW_TOO_STEEP");
  if (Math.abs(rotation) > (12 * Math.PI) / 180) reasons.push("VIEW_OFF_AXIS");
  if (center.y - result.roiImage.y < result.roiImage.height * 0.35) reasons.push("WORKING_REGION_CLIPPED");
  return {
    wheelCenterImage: center,
    // A homography corrects the printed plane, not the vessel above it. Keep the existing
    // weak-perspective limit for sizes until intrinsics/physical tests support a wider model.
    ...(result.quality.scaleVariationFraction > 0.02
      ? { metricUnsupportedReason: "BOARD_PERSPECTIVE_UNSUPPORTED" as const }
      : {}),
    majorAxisImage,
    minorAxisImage,
    projectedVerticalImage,
    downwardAngleRad,
    wheelPlaneMmPerMajorPixel: 1 / majorScale,
    supportedRegionImage: {
      x: result.roiImage.x,
      y: result.roiImage.y,
      width: result.roiImage.width,
      height: Math.max(0, center.y - result.roiImage.y),
    },
    estimatedErrorMm95: result.quality.estimatedErrorMm95,
    confidence: reasons.length === 0 ? 0.9 : 0.5,
    reasons,
  };
}

/** Compares the entered diameter only when an independent rim observation is available. */
export function validateWheelDiameterCrossCheck(result: CalibrationResult, enteredDiameterMm: number): string[] {
  const detected = result.boardPose?.detectedWheelDiameterMm;
  if (!detected) return enteredDiameterMm >= 150 && enteredDiameterMm <= 500 ? [] : ["DIAMETER_IMPLAUSIBLE"];
  return Math.abs(detected - enteredDiameterMm) / enteredDiameterMm > 0.1 ? ["DIAMETER_MISMATCH"] : [];
}

/** Accepts only a short, motion-free run of already valid board solutions. */
export class BoardCalibrationAccumulator {
  private observations: CalibrationObservation[] = [];

  add(observation: CalibrationObservation): void {
    this.observations.push(observation);
    if (this.observations.length > REQUIRED_OBSERVATIONS) this.observations.shift();
  }

  clear(): void {
    this.observations = [];
  }

  result(): CalibrationResult | null {
    if (this.observations.length < REQUIRED_OBSERVATIONS) return null;
    const first = this.observations[0]!;
    const last = this.observations.at(-1)!;
    if (last.capturedAtMs - first.capturedAtMs < REQUIRED_SPAN_MS) return null;
    if (this.observations.some(({ result }) => result.status !== "accepted")) return null;
    const centers = this.observations.map(({ result }) => boardCenter(result));
    const center = centers[0]!;
    if (centers.some((point) => Math.hypot(point.x - center.x, point.y - center.y) > MAX_CENTER_DRIFT_PX)) return null;
    const scales = this.observations.map(({ result }) => meanScale(result.homographyImageToMm));
    const average = scales.reduce((sum, value) => sum + value, 0) / scales.length;
    if ((Math.max(...scales) - Math.min(...scales)) / average > MAX_SCALE_VARIATION) return null;
    return last.result;
  }
}

function boardCenter(result: CalibrationResult): Point2 {
  return applyHomography(invert(result.homographyImageToMm), {
    x: BOARD_V1.widthMm / 2,
    y: BOARD_V1.heightMm / 2,
  });
}

function meanScale(matrix: CalibrationResult["homographyImageToMm"]): number {
  return (Math.hypot(matrix[0], matrix[3]) + Math.hypot(matrix[1], matrix[4])) / 2;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function invert(matrix: CalibrationResult["homographyImageToMm"]): CalibrationResult["homographyImageToMm"] {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(determinant) < 1e-12) throw new Error("Degenerate homography");
  return [
    (e * i - f * h) / determinant,
    (c * h - b * i) / determinant,
    (b * f - c * e) / determinant,
    (f * g - d * i) / determinant,
    (a * i - c * g) / determinant,
    (c * d - a * f) / determinant,
    (d * h - e * g) / determinant,
    (b * g - a * h) / determinant,
    (a * e - b * d) / determinant,
  ];
}
