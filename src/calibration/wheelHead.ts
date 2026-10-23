import { validateCalibration } from "./quality";
import type { CalibrationResult } from "./types";
import { BOARD_V1 } from "./boardV1";
import { detectWheelEllipses, type WheelEllipse } from "./wheelEllipse";

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
const BAND_HALF_HEIGHT = 2;
const SEARCH_TOP_FRACTION = 0.35;
const MIN_HALF_WIDTH_FRACTION = 0.12;
/** A nested pair must sit at least this far inside the one around it, on both sides. */
const NESTED_MARGIN_FRACTION = 0.03;
const MAX_CANDIDATES = 3;
/** Mean brightness difference (0–255) below which two nested pairs are taken to be the same surface. */
const SAME_SURFACE_DIFFERENCE = 12;

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
 * Edge strength is the horizontal gradient summed over a five-row band. Narrower pairs nested inside
 * it are returned too, so a tray around the wheel head can be stepped past.
 */
export function detectWheelHead(image: GrayImage): WheelHeadCandidates {
  const { gray, width, height } = image;
  const band = signedBandGradient(gray, width, height);
  const top = Math.max(BAND_HALF_HEIGHT + 1, Math.floor(height * SEARCH_TOP_FRACTION));
  const bottom = height - BAND_HALF_HEIGHT - 1;
  let meanAbs = 0;
  let samples = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      meanAbs += Math.abs(band[y * width + x]!);
      samples += 1;
    }
  }
  meanAbs = samples ? meanAbs / samples : 0;
  const search = { band, width, height, top, bottom, meanAbs };
  const margin = Math.max(2, Math.round(width * NESTED_MARGIN_FRACTION));
  const candidates: WheelHeadDetection[] = [];
  const ellipses = detectWheelEllipses(image);
  let bounds = { left: 1, right: width - 2 };
  let lastSurface: number | null = null;
  while (candidates.length < MAX_CANDIDATES) {
    const found = widestPair(search, bounds);
    if (!found) break;
    bounds = { left: found.leftX + margin, right: found.rightX - margin };
    const detection = refine(gray, width, height, found, meanAbs);
    // Only the outermost guess is kept when it's weak; inner ones must be real edges.
    if (candidates.length && detection.confidence < CONFIDENT_DETECTION) continue;
    // The same disc seen again at a narrower row has the same surface between its edges; a wheel
    // head inside a tray (or a bat on a wheel head) doesn't.
    const surface = surfaceBrightness(gray, width, found);
    if (lastSurface !== null && Math.abs(surface - lastSurface) < SAME_SURFACE_DIFFERENCE) continue;
    lastSurface = surface;
    const ellipse = ellipses.find(
      (candidate) => Math.abs(candidate.centerX - (detection.leftX + detection.rightX) / 2) < width * 0.08,
    );
    candidates.push(ellipse ? { ...detection, ellipse } : detection);
  }
  const outermost = candidates[0] ?? {
    leftX: Math.round(width * 0.2),
    rightX: Math.round(width * 0.8),
    row: Math.round(height * 0.75),
    confidence: 0,
  };
  return { ...outermost, candidates: candidates.length ? candidates : [outermost] };
}

type Search = { band: Float32Array; width: number; height: number; top: number; bottom: number; meanAbs: number };
type Pair = { leftX: number; rightX: number; row: number; raw: number };

function widestPair(
  { band, width, top, bottom, meanAbs }: Search,
  bounds: { left: number; right: number },
): Pair | null {
  const minHalfWidth = Math.max(3, Math.floor(width * MIN_HALF_WIDTH_FRACTION));
  let best: (Pair & { score: number }) | null = null;
  for (let y = top; y < bottom; y += 1) {
    const row = y * width;
    for (let left = bounds.left; left < bounds.right - 2 * minHalfWidth; left += 1) {
      const leftEdge = band[row + left]!;
      if (Math.abs(leftEdge) < meanAbs * 2) continue;
      for (let right = left + 2 * minHalfWidth; right <= bounds.right; right += 1) {
        const rightEdge = band[row + right]!;
        // Entering the disc and leaving it change brightness in opposite directions.
        const raw = leftEdge > 0 ? Math.min(leftEdge, -rightEdge) : Math.min(-leftEdge, rightEdge);
        if (raw <= 0) continue;
        const score = raw * (0.5 + (right - left) / width);
        if (!best || score > best.score) best = { leftX: left, rightX: right, row: y, raw, score };
      }
    }
  }
  return best;
}

/** Brightness just inside both edges: the surface the pair encloses, without whatever sits nested in it. */
function surfaceBrightness(gray: Float32Array, width: number, pair: Pair): number {
  const span = pair.rightX - pair.leftX;
  const from = Math.max(1, Math.round(span * 0.02));
  const to = Math.max(from + 1, Math.round(span * 0.06));
  let sum = 0;
  let count = 0;
  for (let offset = from; offset <= to; offset += 1) {
    sum += gray[pair.row * width + pair.leftX + offset]! + gray[pair.row * width + pair.rightX - offset]!;
    count += 2;
  }
  return sum / count;
}

function refine(gray: Float32Array, width: number, height: number, pair: Pair, meanAbs: number): WheelHeadDetection {
  const ratio = meanAbs > 0 ? pair.raw / meanAbs : 0;
  // The band blurs the disc's curved ends inward; snap each edge to the sharpest single-row gradient
  // nearby, choosing the outermost row in the band where the edge is still strong.
  const leftX = refineEdge(gray, width, height, pair.row, pair.leftX, -1);
  const rightX = refineEdge(gray, width, height, pair.row, pair.rightX, 1);
  return { leftX, rightX, row: pair.row, confidence: clamp((ratio - 3) / 7, 0, 1) };
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
