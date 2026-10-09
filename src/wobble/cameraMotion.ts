import type { Point2 } from "../calibration/types";

export type StaticFeature = { from: Point2; to: Point2 };
export type CameraTransformEstimate = { dxMm: number; dyMm: number; rotationRad: number; confidence: number; residualMm: number };

export function estimateCameraTransform(features: StaticFeature[]): CameraTransformEstimate {
  if (features.length === 0) return { dxMm: 0, dyMm: 0, rotationRad: 0, confidence: 0, residualMm: Number.POSITIVE_INFINITY };
  const dx = median(features.map((feature) => feature.to.x - feature.from.x));
  const dy = median(features.map((feature) => feature.to.y - feature.from.y));
  const residuals = features.map((feature) => Math.hypot(feature.to.x - feature.from.x - dx, feature.to.y - feature.from.y - dy));
  const threshold = Math.max(0.5, median(residuals) * 3);
  const inliers = features.filter((_, index) => residuals[index]! <= threshold);
  const xSpan = inliers.length ? Math.max(...inliers.map((item) => item.from.x)) - Math.min(...inliers.map((item) => item.from.x)) : 0;
  const ySpan = inliers.length ? Math.max(...inliers.map((item) => item.from.y)) - Math.min(...inliers.map((item) => item.from.y)) : 0;
  const spatial = xSpan > 1 && ySpan > 1 ? 1 : 0.5;
  return {
    dxMm: dx,
    dyMm: dy,
    rotationRad: estimateRotation(inliers, dx, dy),
    confidence: Math.min(1, inliers.length / 3) * spatial,
    residualMm: median(residuals.filter((value) => value <= threshold)),
  };
}

function estimateRotation(features: StaticFeature[], dx: number, dy: number): number {
  if (features.length < 3) return 0;
  const center = { x: median(features.map((item) => item.from.x)), y: median(features.map((item) => item.from.y)) };
  return median(features.map((feature) => {
    const before = Math.atan2(feature.from.y - center.y, feature.from.x - center.x);
    const after = Math.atan2(feature.to.y - dy - center.y, feature.to.x - dx - center.x);
    return after - before;
  }));
}

function median(values: number[]): number { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]!; }
