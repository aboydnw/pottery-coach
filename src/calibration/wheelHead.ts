import { validateCalibration } from "./quality";
import type { CalibrationResult } from "./types";
import { BOARD_V1 } from "./boardV1";
import { detectWheelEllipses, type WheelEllipse } from "./wheelEllipse";
import { deriveWheelViewPose } from "./wheelViewPose";

export type GrayImage = { gray: Float32Array; width: number; height: number };

export type WheelHeadDetection = {
  /** Edges and row in the coordinates of the image that was searched. */
  leftX: number;
  rightX: number;
  row: number;
  /** 0–1; below `CONFIDENT_DETECTION` the UI asks the user to place the markers. */
  confidence: number;
  /** Complete-rim geometry when the ellipse detector can support it. */
  ellipse?: WheelEllipse;
};

export type WheelHeadCandidates = WheelHeadDetection & {
  /**
   * Edge pairs found nested inside one another, outermost first (this detection is the first). A
   * splash pan or tray around the wheel head shows up as an outer pair with the wheel head inside it.
   */
  candidates: WheelHeadDetection[];
};

export const CONFIDENT_DETECTION = 0.5;
export const MIN_WHEEL_DIAMETER_MM = 200;
export const MAX_WHEEL_DIAMETER_MM = 500;
/** Assumed uncertainty of each confirmed edge, in full-resolution pixels. */
const EDGE_UNCERTAINTY_PX = 2;

/** Converts RGBA pixels to luminance, downscaling (by area averaging) to at most `maxWidth` columns. */
export function toGray(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  maxWidth = 320,
): GrayImage & { scale: number } {
  const factor = Math.max(1, Math.ceil(width / maxWidth));
  const outWidth = Math.floor(width / factor);
  const outHeight = Math.floor(height / factor);
  const gray = new Float32Array(outWidth * outHeight);
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const offset = ((y * factor + dy) * width + x * factor + dx) * 4;
          sum += 0.299 * rgba[offset]! + 0.587 * rgba[offset + 1]! + 0.114 * rgba[offset + 2]!;
        }
      }
      gray[y * outWidth + x] = sum / (factor * factor);
    }
  }
  return { gray, width: outWidth, height: outHeight, scale: factor };
}

/** Finds only wheel heads backed by a complete, geometrically supported rim. */
export function detectWheelHead(image: GrayImage): WheelHeadCandidates {
  const { width, height } = image;
  const candidates: WheelHeadDetection[] = detectWheelEllipses(image).map((ellipse) => ({
    leftX: ellipse.centerX - ellipse.radiusMajor,
    rightX: ellipse.centerX + ellipse.radiusMajor,
    row: ellipse.centerY,
    confidence: ellipse.confidence,
    ellipse,
  }));
  const outermost = candidates[0] ?? {
    leftX: Math.round(width * 0.2),
    rightX: Math.round(width * 0.8),
    row: Math.round(height * 0.75),
    confidence: 0,
  };
  return { ...outermost, candidates: candidates.length ? candidates : [outermost] };
}

/**
 * Builds a scale-only calibration from confirmed wheel-head edges (full-resolution pixels) and the
 * wheel head's real diameter. Status and reasons come from the shared quality gates.
 */
export function wheelHeadCalibration(input: {
  leftX: number;
  rightX: number;
  row: number;
  diameterMm: number;
  frameWidth: number;
  frameHeight: number;
  adjustedByUser: boolean;
}): CalibrationResult {
  const span = input.rightX - input.leftX;
  const mmPerPixel = span > 0 ? input.diameterMm / span : 0;
  const result: CalibrationResult = {
    id: globalThis.crypto?.randomUUID?.() ?? `wheel-calibration-${Date.now()}`,
    method: "wheel-head",
    createdAtMs: Date.now(),
    status: "accepted",
    homographyImageToMm: [mmPerPixel, 0, 0, 0, mmPerPixel, 0, 0, 0, 1],
    wheelBaseline: [
      { x: input.leftX * mmPerPixel, y: input.row * mmPerPixel },
      { x: input.rightX * mmPerPixel, y: input.row * mmPerPixel },
    ],
    wheelCenterlineXmm: ((input.leftX + input.rightX) / 2) * mmPerPixel,
    roiImage: { x: 0, y: 0, width: input.frameWidth, height: input.frameHeight },
    markerPlaneOffsetToleranceMm: BOARD_V1.calibration.markerPlaneOffsetToleranceMm,
    quality: {
      tagCount: 0,
      reprojectionErrorPx95: 0,
      scaleVariationFraction: 0,
      estimatedErrorMm95: 2 * EDGE_UNCERTAINTY_PX * mmPerPixel,
      poseYawDeg: null,
      posePitchDeg: null,
      blurScore: 1,
      contrastScore: 1,
    },
    reasons: [],
    provenance: input.adjustedByUser ? "manual-assisted" : "automatic",
    boardRevision: BOARD_V1.revision,
    supportedBoardRevision: BOARD_V1.revision,
    roiClipped: false,
    imageCenterlineX: (input.leftX + input.rightX) / 2,
    wheelHead: { leftX: input.leftX, rightX: input.rightX, row: input.row, diameterMm: input.diameterMm },
  };
  result.reasons = validateCalibration(result);
  result.status = result.reasons.length === 0 ? "accepted" : "rejected";
  return result;
}

/** Builds perspective-aware wheel calibration from a complete detected circular rim. */
export function wheelEllipseCalibration(input: {
  ellipse: WheelEllipse;
  diameterMm: number;
  frameWidth: number;
  frameHeight: number;
  adjustedByUser: boolean;
}): CalibrationResult {
  const ellipse = input.adjustedByUser
    ? { ...input.ellipse, fitResidualPx95: EDGE_UNCERTAINTY_PX, visibleArcFraction: 1, confidence: 1 }
    : input.ellipse;
  const pose = deriveWheelViewPose(ellipse, input.diameterMm, {
    width: input.frameWidth,
    height: input.frameHeight,
  });
  const mmPerPixel = pose.wheelPlaneMmPerMajorPixel;
  const result: CalibrationResult = {
    id: globalThis.crypto?.randomUUID?.() ?? `wheel-calibration-${Date.now()}`,
    method: "wheel-head",
    createdAtMs: Date.now(),
    status: "accepted",
    // Retained for legacy readers only. New measurement uses wheelViewPose.
    homographyImageToMm: [mmPerPixel, 0, 0, 0, mmPerPixel, 0, 0, 0, 1],
    wheelBaseline: [
      { x: -input.diameterMm / 2, y: 0 },
      { x: input.diameterMm / 2, y: 0 },
    ],
    wheelCenterlineXmm: 0,
    roiImage: { x: 0, y: 0, width: input.frameWidth, height: input.frameHeight },
    markerPlaneOffsetToleranceMm: BOARD_V1.calibration.markerPlaneOffsetToleranceMm,
    quality: {
      tagCount: 0,
      reprojectionErrorPx95: ellipse.fitResidualPx95,
      scaleVariationFraction: 0,
      estimatedErrorMm95: pose.estimatedErrorMm95,
      poseYawDeg: null,
      posePitchDeg: (pose.downwardAngleRad * 180) / Math.PI,
      blurScore: 1,
      contrastScore: 1,
      ellipseFitResidualPx95: ellipse.fitResidualPx95,
      visibleArcFraction: ellipse.visibleArcFraction,
    },
    reasons: [...pose.reasons],
    provenance: input.adjustedByUser ? "manual-assisted" : "automatic",
    boardRevision: BOARD_V1.revision,
    supportedBoardRevision: BOARD_V1.revision,
    roiClipped: false,
    imageCenterlineX: ellipse.centerX,
    wheelHead: {
      leftX: ellipse.centerX - ellipse.radiusMajor,
      rightX: ellipse.centerX + ellipse.radiusMajor,
      row: ellipse.centerY,
      diameterMm: input.diameterMm,
    },
    wheelEllipse: ellipse,
    wheelViewPose: pose,
  };
  result.reasons = [...new Set([...result.reasons, ...validateCalibration(result)])];
  result.status = result.reasons.length === 0 ? "accepted" : "rejected";
  return result;
}
