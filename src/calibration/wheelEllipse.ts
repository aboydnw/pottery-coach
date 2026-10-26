import { fitWheelEllipseProposals, traceWheelArcs } from "./wheelArcs";
import {
  extractWheelEdges,
  type GrayImage,
  type WheelCaptureQuality,
  type WheelEdgeMap,
  type WheelEdgePoint,
} from "./wheelEdges";

export type WheelEllipse = {
  centerX: number;
  centerY: number;
  radiusMajor: number;
  radiusMinor: number;
  rotationRad: number;
  fitResidualPx95: number;
  visibleArcFraction: number;
  confidence: number;
};

export type WheelEllipseEvidence = {
  fitResidualPx95: number;
  visibleArcFraction: number;
  longestMissingArcFraction: number;
  supportedSectors: Uint8Array;
  orientationAgreement: number;
};

export type WheelEllipseCandidate = WheelEllipse & { score: number; evidence: WheelEllipseEvidence };

export type WheelDetectionResult = {
  candidates: WheelEllipseCandidate[];
  quality: WheelCaptureQuality;
};

/** Normalizes equivalent ellipse representations to one stable form. */
export function canonicalWheelEllipse(input: WheelEllipse): WheelEllipse {
  const values = Object.values(input);
  if (!values.every(Number.isFinite)) throw new Error("Ellipse geometry must be finite");
  if (input.radiusMajor <= 0 || input.radiusMinor <= 0) throw new Error("Ellipse radii must be positive");
  const swapped = input.radiusMinor > input.radiusMajor;
  return {
    ...input,
    radiusMajor: swapped ? input.radiusMinor : input.radiusMajor,
    radiusMinor: swapped ? input.radiusMajor : input.radiusMinor,
    rotationRad: normalizeHalfTurn(input.rotationRad + (swapped ? Math.PI / 2 : 0)),
    visibleArcFraction: clamp(input.visibleArcFraction, 0, 1),
    confidence: clamp(input.confidence, 0, 1),
  };
}

/** Finds complete circular rims projected as ellipses in the lower part of a frame. */
export function detectWheelEllipses(image: GrayImage): WheelEllipseCandidate[] {
  return detectWheelEllipseResult(image).candidates;
}

export function detectWheelEllipseResult(image: GrayImage): WheelDetectionResult {
  const edgeMap = extractWheelEdges(image);
  if (edgeMap.quality.reasons.includes("LOW_CONTRAST")) return { candidates: [], quality: edgeMap.quality };
  const proposals = fitWheelEllipseProposals(traceWheelArcs(edgeMap), image);
  const candidates = proposals
    .map((proposal) => scoreCandidate(canonicalWheelEllipse(proposal), edgeMap))
    .filter((candidate): candidate is WheelEllipseCandidate => candidate !== null)
    .sort((left, right) => right.score - left.score)
    .filter((candidate, index, all) => all.findIndex((other) => sameSurface(candidate, other, image)) === index)
    .slice(0, 3)
    .sort((left, right) => right.radiusMajor - left.radiusMajor);
  return { candidates, quality: edgeMap.quality };
}

export function measureEllipseEvidence(ellipse: WheelEllipse, edgeMap: WheelEdgeMap): WheelEllipseEvidence {
  const supportedSectors = new Uint8Array(72);
  let orientationTotal = 0;
  let orientationCount = 0;
  const residuals: number[] = [];
  const cosine = Math.cos(ellipse.rotationRad);
  const sine = Math.sin(ellipse.rotationRad);
  const tolerance = Math.max(2.5, ellipse.radiusMinor * 0.08);
  const buckets = bucketPoints(edgeMap.points);
  for (let sector = 0; sector < supportedSectors.length; sector += 1) {
    const angle = ((sector + 0.5) / supportedSectors.length) * Math.PI * 2;
    const localX = ellipse.radiusMajor * Math.cos(angle);
    const localY = ellipse.radiusMinor * Math.sin(angle);
    const x = ellipse.centerX + cosine * localX - sine * localY;
    const y = ellipse.centerY + sine * localX + cosine * localY;
    const normalLocalX = Math.cos(angle) / ellipse.radiusMajor;
    const normalLocalY = Math.sin(angle) / ellipse.radiusMinor;
    const normalLength = Math.hypot(normalLocalX, normalLocalY);
    const normalX = (cosine * normalLocalX - sine * normalLocalY) / normalLength;
    const normalY = (sine * normalLocalX + cosine * normalLocalY) / normalLength;
    const nearest = nearestPoint(buckets, x, y, tolerance);
    if (!nearest) continue;
    const distance = Math.hypot(nearest.x - x, nearest.y - y);
    const agreement = Math.abs(nearest.normalX * normalX + nearest.normalY * normalY);
    if (agreement < 0.35) continue;
    supportedSectors[sector] = 1;
    residuals.push(distance);
    orientationTotal += agreement;
    orientationCount += 1;
  }
  const visibleArcFraction = supportedSectors.reduce((sum, value) => sum + value, 0) / supportedSectors.length;
  return {
    fitResidualPx95: percentile(residuals, 0.95),
    visibleArcFraction,
    longestMissingArcFraction: longestMissingRun(supportedSectors) / supportedSectors.length,
    supportedSectors,
    orientationAgreement: orientationCount === 0 ? 0 : orientationTotal / orientationCount,
  };
}

function scoreCandidate(ellipse: WheelEllipse, edgeMap: WheelEdgeMap): WheelEllipseCandidate | null {
  const { width, height } = edgeMap;
  const evidence = measureEllipseEvidence(ellipse, edgeMap);
  const ratio = ellipse.radiusMinor / ellipse.radiusMajor;
  const margin = 2;
  const extentX = Math.hypot(
    ellipse.radiusMajor * Math.cos(ellipse.rotationRad),
    ellipse.radiusMinor * Math.sin(ellipse.rotationRad),
  );
  const extentY = Math.hypot(
    ellipse.radiusMajor * Math.sin(ellipse.rotationRad),
    ellipse.radiusMinor * Math.cos(ellipse.rotationRad),
  );
  const framed =
    ellipse.centerX - extentX >= margin &&
    ellipse.centerX + extentX < width - margin &&
    ellipse.centerY - extentY >= margin &&
    ellipse.centerY + extentY < height - margin;
  const quadrants = [0, 18, 36, 54].every((start) =>
    evidence.supportedSectors.slice(start, start + 18).some((value) => value === 1),
  );
  if (
    !framed ||
    !quadrants ||
    ellipse.radiusMajor < width * 0.24 ||
    ellipse.centerY < height * 0.48 ||
    ratio < 0.2 ||
    ratio > 0.9 ||
    evidence.visibleArcFraction < 0.78 ||
    evidence.longestMissingArcFraction > 0.14
  )
    return null;
  const residualQuality = Math.exp(-evidence.fitResidualPx95 / Math.max(2, ellipse.radiusMinor * 0.08));
  const locationQuality = clamp((ellipse.centerY / height - 0.45) / 0.35, 0, 1);
  const sizeQuality = clamp(ellipse.radiusMajor / (width * 0.4), 0, 1);
  const confidence = clamp(
    evidence.visibleArcFraction * 0.45 +
      evidence.orientationAgreement * 0.2 +
      residualQuality * 0.2 +
      locationQuality * 0.1 +
      sizeQuality * 0.05,
    0,
    1,
  );
  return {
    ...ellipse,
    fitResidualPx95: evidence.fitResidualPx95,
    visibleArcFraction: evidence.visibleArcFraction,
    confidence,
    evidence,
    score: confidence * (0.7 + 0.3 * sizeQuality),
  };
}

function bucketPoints(points: WheelEdgePoint[]): Map<string, WheelEdgePoint[]> {
  const buckets = new Map<string, WheelEdgePoint[]>();
  for (const point of points) {
    const key = `${Math.floor(point.x / 4)},${Math.floor(point.y / 4)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(point);
    buckets.set(key, bucket);
  }
  return buckets;
}

function nearestPoint(
  buckets: Map<string, WheelEdgePoint[]>,
  x: number,
  y: number,
  tolerance: number,
): WheelEdgePoint | null {
  let nearest: WheelEdgePoint | null = null;
  let nearestDistance = tolerance;
  const radius = Math.ceil(tolerance / 4);
  const bucketX = Math.floor(x / 4);
  const bucketY = Math.floor(y / 4);
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (const point of buckets.get(`${bucketX + dx},${bucketY + dy}`) ?? []) {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance <= nearestDistance) {
          nearest = point;
          nearestDistance = distance;
        }
      }
    }
  }
  return nearest;
}

function longestMissingRun(sectors: Uint8Array): number {
  let longest = 0;
  let current = 0;
  for (let index = 0; index < sectors.length * 2; index += 1) {
    if (sectors[index % sectors.length]) current = 0;
    else current += 1;
    longest = Math.max(longest, Math.min(current, sectors.length));
  }
  return longest;
}

function sameSurface(left: WheelEllipse, right: WheelEllipse, frame: GrayImage): boolean {
  return (
    Math.hypot(left.centerX - right.centerX, left.centerY - right.centerY) <
      Math.min(frame.width, frame.height) * 0.025 &&
    Math.abs(left.radiusMajor - right.radiusMajor) < frame.width * 0.025 &&
    Math.abs(left.radiusMinor - right.radiusMinor) < frame.height * 0.025
  );
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  return [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))]!;
}

function normalizeHalfTurn(angle: number): number {
  const normalized = angle % Math.PI;
  return normalized < 0 ? normalized + Math.PI : normalized;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
