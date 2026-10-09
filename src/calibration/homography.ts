import { validateCalibration } from "./quality";
import type { CalibrationBoard, CalibrationFrame, CalibrationResult, Point2, PointCorrespondence } from "./types";

type Matrix3 = CalibrationResult["homographyImageToMm"];

export function solveCalibration(
  corners: PointCorrespondence[],
  board: CalibrationBoard,
  frame: CalibrationFrame,
): CalibrationResult {
  if (corners.length < 4) throw new Error("Degenerate calibration: at least four points are required");
  const homography = solveHomography(corners);
  const inverse = invertHomography(homography);
  const residuals = corners.map(({ image, boardMm }) => {
    const projected = applyHomography(inverse, boardMm);
    return Math.hypot(projected.x - image.x, projected.y - image.y);
  });
  const scales = corners.map(({ image }) => localScale(homography, image));
  const meanScale = scales.reduce((sum, value) => sum + value, 0) / scales.length;
  const scaleVariation = meanScale === 0
    ? Number.POSITIVE_INFINITY
    : (Math.max(...scales) - Math.min(...scales)) / meanScale;
  const roiClipped = frame.roi.x < 0 || frame.roi.y < 0 ||
    frame.roi.x + frame.roi.width > frame.width ||
    frame.roi.y + frame.roi.height > frame.height;

  const result: CalibrationResult = {
    id: globalThis.crypto?.randomUUID?.() ?? `calibration-${Date.now()}`,
    createdAtMs: Date.now(),
    status: "accepted",
    homographyImageToMm: homography,
    wheelBaseline: board.wheelBaseline,
    wheelCenterlineXmm: board.wheelCenterlineXmm,
    roiImage: frame.roi,
    markerPlaneOffsetToleranceMm: board.markerPlaneOffsetToleranceMm,
    quality: {
      tagCount: Math.min(4, corners.length),
      reprojectionErrorPx95: percentile(residuals, 0.95),
      scaleVariationFraction: scaleVariation,
      estimatedErrorMm95: percentile(residuals, 0.95) * meanScale,
      poseYawDeg: frame.poseYawDeg,
      posePitchDeg: frame.posePitchDeg,
      blurScore: frame.blurScore,
      contrastScore: frame.contrastScore,
    },
    reasons: [],
    provenance: "automatic",
    boardRevision: board.revision,
    supportedBoardRevision: board.supportedRevision,
    roiClipped,
  };
  result.reasons = validateCalibration(result);
  result.status = result.reasons.length === 0 ? "accepted" : "rejected";
  return result;
}

export function applyHomography(matrix: readonly number[], point: Point2): Point2 {
  const denominator = matrix[6]! * point.x + matrix[7]! * point.y + matrix[8]!;
  if (Math.abs(denominator) < 1e-12) throw new Error("Point maps to infinity");
  return {
    x: (matrix[0]! * point.x + matrix[1]! * point.y + matrix[2]!) / denominator,
    y: (matrix[3]! * point.x + matrix[4]! * point.y + matrix[5]!) / denominator,
  };
}

function solveHomography(points: PointCorrespondence[]): Matrix3 {
  const rows: number[][] = [];
  const values: number[] = [];
  for (const { image: { x, y }, boardMm: { x: u, y: v } } of points) {
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const normal = Array.from({ length: 8 }, () => Array(8).fill(0) as number[]);
  const rhs = Array(8).fill(0) as number[];
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      rhs[column]! += rows[row]![column]! * values[row]!;
      for (let inner = 0; inner < 8; inner += 1) {
        normal[column]![inner]! += rows[row]![column]! * rows[row]![inner]!;
      }
    }
  }
  const solved = gaussianSolve(normal, rhs);
  return [...solved, 1] as Matrix3;
}

function gaussianSolve(matrix: number[][], values: number[]): number[] {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    }
    if (Math.abs(augmented[pivot]![column]!) < 1e-9) throw new Error("Degenerate calibration geometry");
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    for (let index = column; index <= size; index += 1) augmented[column]![index]! /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      for (let index = column; index <= size; index += 1) {
        augmented[row]![index]! -= factor * augmented[column]![index]!;
      }
    }
  }
  return augmented.map((row) => row[size]!);
}

function invertHomography(matrix: Matrix3): Matrix3 {
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

function localScale(matrix: Matrix3, point: Point2): number {
  const origin = applyHomography(matrix, point);
  const alongX = applyHomography(matrix, { x: point.x + 1, y: point.y });
  const alongY = applyHomography(matrix, { x: point.x, y: point.y + 1 });
  return (Math.hypot(alongX.x - origin.x, alongX.y - origin.y) +
    Math.hypot(alongY.x - origin.x, alongY.y - origin.y)) / 2;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}
