import { validateCalibration } from "./quality";
import type { CalibrationResult } from "./types";
import { BOARD_V1 } from "./boardV1";

export type GrayImage = { gray: Float32Array; width: number; height: number };

export type WheelHeadDetection = {
  /** Edges and row in the coordinates of the image that was searched. */
  leftX: number;
  rightX: number;
  row: number;
  /** 0–1; below `CONFIDENT_DETECTION` the UI asks the user to place the markers. */
  confidence: number;
};

export const CONFIDENT_DETECTION = 0.5;
export const MIN_WHEEL_DIAMETER_MM = 200;
export const MAX_WHEEL_DIAMETER_MM = 500;
/** Assumed uncertainty of each confirmed edge, in full-resolution pixels. */
const EDGE_UNCERTAINTY_PX = 2;
const BAND_HALF_HEIGHT = 2;
const SEARCH_TOP_FRACTION = 0.35;
const MIN_HALF_WIDTH_FRACTION = 0.12;

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

/**
 * Finds the wheel head in a side view: the widest pair of vertical edges in the lower part of the
 * frame where both edges change brightness the same way (the same disc material lies between them).
 * Edge strength is the horizontal gradient summed over a five-row band.
 */
export function detectWheelHead({ gray, width, height }: GrayImage): WheelHeadDetection {
  const band = signedBandGradient(gray, width, height);
  const top = Math.max(BAND_HALF_HEIGHT + 1, Math.floor(height * SEARCH_TOP_FRACTION));
  const bottom = height - BAND_HALF_HEIGHT - 1;
  const minHalfWidth = Math.max(3, Math.floor(width * MIN_HALF_WIDTH_FRACTION));
  let meanAbs = 0;
  let samples = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      meanAbs += Math.abs(band[y * width + x]!);
      samples += 1;
    }
  }
  meanAbs = samples ? meanAbs / samples : 0;
  let best = {
    leftX: Math.round(width * 0.2),
    rightX: Math.round(width * 0.8),
    row: Math.round(height * 0.75),
    raw: 0,
    score: 0,
  };
  for (let y = top; y < bottom; y += 1) {
    const row = y * width;
    for (let left = 1; left < width - 1 - 2 * minHalfWidth; left += 1) {
      const leftEdge = band[row + left]!;
      if (Math.abs(leftEdge) < meanAbs * 2) continue;
      for (let right = left + 2 * minHalfWidth; right < width - 1; right += 1) {
        const rightEdge = band[row + right]!;
        // Entering the disc and leaving it change brightness in opposite directions.
        const raw = leftEdge > 0 ? Math.min(leftEdge, -rightEdge) : Math.min(-leftEdge, rightEdge);
        if (raw <= 0) continue;
        const score = raw * (0.5 + (right - left) / width);
        if (score > best.score) best = { leftX: left, rightX: right, row: y, raw, score };
      }
    }
  }
  const ratio = meanAbs > 0 ? best.raw / meanAbs : 0;
  // The band blurs the disc's curved ends inward; snap each edge to the sharpest single-row gradient
  // nearby, choosing the outermost row in the band where the edge is still strong.
  const leftX = refineEdge(gray, width, height, best.row, best.leftX, -1);
  const rightX = refineEdge(gray, width, height, best.row, best.rightX, 1);
  return { leftX, rightX, row: best.row, confidence: clamp((ratio - 3) / 7, 0, 1) };
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

function refineEdge(
  gray: Float32Array,
  width: number,
  height: number,
  row: number,
  x: number,
  outward: -1 | 1,
): number {
  let bestX = x;
  let bestStrength = 0;
  for (let y = Math.max(0, row - BAND_HALF_HEIGHT); y <= Math.min(height - 1, row + BAND_HALF_HEIGHT); y += 1) {
    for (let offset = -2; offset <= 6; offset += 1) {
      const candidate = x + outward * offset;
      if (candidate < 1 || candidate > width - 2) continue;
      const strength = Math.abs(gray[y * width + candidate + 1]! - gray[y * width + candidate - 1]!);
      const further = (candidate - bestX) * outward > 0;
      if (strength > bestStrength * 1.15 || (strength > bestStrength * 0.6 && further)) {
        bestStrength = Math.max(bestStrength, strength);
        bestX = candidate;
      }
    }
  }
  return bestX;
}

function signedBandGradient(gray: Float32Array, width: number, height: number): Float32Array {
  const gradient = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 1; x < width - 1; x += 1)
      gradient[y * width + x] = gray[y * width + x + 1]! - gray[y * width + x - 1]!;
  }
  const band = new Float32Array(width * height);
  for (let y = BAND_HALF_HEIGHT; y < height - BAND_HALF_HEIGHT; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0;
      for (let dy = -BAND_HALF_HEIGHT; dy <= BAND_HALF_HEIGHT; dy += 1) sum += gradient[(y + dy) * width + x]!;
      band[y * width + x] = sum;
    }
  }
  return band;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
