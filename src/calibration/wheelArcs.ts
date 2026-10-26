import type { WheelEdgeMap, WheelEdgePoint } from "./wheelEdges";
import type { WheelEllipse } from "./wheelEllipse";

export type FrameSize = { width: number; height: number };

export type WheelArc = {
  points: WheelEdgePoint[];
  angularSpanRad: number;
  meanStrength: number;
  polarity: -1 | 0 | 1;
};

/** Groups connected curved edge evidence and rejects texture specks and straight furniture edges. */
export function traceWheelArcs(edgeMap: WheelEdgeMap): WheelArc[] {
  const rowCounts = new Map<number, number>();
  const columnCounts = new Map<number, number>();
  for (const point of edgeMap.points) {
    rowCounts.set(point.y, (rowCounts.get(point.y) ?? 0) + 1);
    columnCounts.set(point.x, (columnCounts.get(point.x) ?? 0) + 1);
  }
  const rowLimit = Math.max(40, edgeMap.width * 0.18);
  const columnLimit = Math.max(40, edgeMap.height * 0.3);
  const unique = new Map<string, WheelEdgePoint>();
  for (const point of edgeMap.points) {
    if ((rowCounts.get(point.y) ?? 0) > rowLimit || (columnCounts.get(point.x) ?? 0) > columnLimit) continue;
    unique.set(`${point.x},${point.y}`, point);
  }
  const visited = new Set<string>();
  const arcs: WheelArc[] = [];
  for (const [key, start] of unique) {
    if (visited.has(key)) continue;
    const queue = [start];
    const points: WheelEdgePoint[] = [];
    visited.add(key);
    while (queue.length > 0) {
      const point = queue.pop()!;
      points.push(point);
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const neighborKey = `${point.x + dx},${point.y + dy}`;
          const neighbor = unique.get(neighborKey);
          if (!neighbor || visited.has(neighborKey)) continue;
          const normalAgreement = Math.abs(point.normalX * neighbor.normalX + point.normalY * neighbor.normalY);
          if (normalAgreement < 0.65) continue;
          visited.add(neighborKey);
          queue.push(neighbor);
        }
      }
    }
    if (points.length < 16) continue;
    const moments = pointMoments(points);
    if (!moments || moments.lambdaMinor / moments.lambdaMajor < 0.015) continue;
    const strengths = points.reduce((sum, point) => sum + point.strength, 0);
    const polaritySum = points.reduce((sum, point) => sum + point.polarity, 0);
    arcs.push({
      points,
      angularSpanRad: estimateAngularSpan(points, moments),
      meanStrength: strengths / points.length,
      polarity: Math.abs(polaritySum) < points.length * 0.2 ? 0 : polaritySum > 0 ? 1 : -1,
    });
  }
  return arcs.sort((a, b) => b.points.length - a.points.length);
}

/** Fits canonical ellipse proposals from curved traces using robust boundary moments. */
export function fitWheelEllipseProposals(arcs: WheelArc[], _frame: FrameSize): WheelEllipse[] {
  const proposals: WheelEllipse[] = [];
  const inputs = arcs.slice(0, 24).map((arc) => arc.points);
  for (let left = 0; left < Math.min(arcs.length, 12); left += 1) {
    for (let right = left + 1; right < Math.min(arcs.length, 12); right += 1) {
      if (boundingBoxGap(arcs[left]!.points, arcs[right]!.points) <= 6)
        inputs.push([...arcs[left]!.points, ...arcs[right]!.points]);
    }
  }
  for (const input of inputs) {
    const arc = { points: input };
    let points = arc.points;
    let fit: ReturnType<typeof fitBoundary> = null;
    for (let pass = 0; pass < 3; pass += 1) {
      fit = fitBoundary(points);
      if (!fit) break;
      const limit = Math.max(2.5, percentile(fit.residuals, 0.85) * 1.5);
      const inliers = points.filter((_point, index) => fit!.residuals[index]! <= limit);
      if (inliers.length < 16 || inliers.length === points.length) break;
      points = inliers;
    }
    fit = fitBoundary(points);
    if (!fit) continue;
    const ratio = fit.ellipse.radiusMinor / fit.ellipse.radiusMajor;
    if (ratio < 0.18 || ratio > 1 || fit.ellipse.radiusMajor < 8 || fit.ellipse.visibleArcFraction < 0.55) continue;
    proposals.push(fit.ellipse);
  }
  return proposals;
}

function boundingBoxGap(left: WheelEdgePoint[], right: WheelEdgePoint[]): number {
  const bounds = (points: WheelEdgePoint[]) => ({
    minimumX: Math.min(...points.map((point) => point.x)),
    maximumX: Math.max(...points.map((point) => point.x)),
    minimumY: Math.min(...points.map((point) => point.y)),
    maximumY: Math.max(...points.map((point) => point.y)),
  });
  const a = bounds(left);
  const b = bounds(right);
  const gapX = Math.max(0, a.minimumX - b.maximumX, b.minimumX - a.maximumX);
  const gapY = Math.max(0, a.minimumY - b.maximumY, b.minimumY - a.maximumY);
  return Math.hypot(gapX, gapY);
}

function fitBoundary(points: WheelEdgePoint[]): { ellipse: WheelEllipse; residuals: number[] } | null {
  const moments = pointMoments(points);
  if (!moments) return null;
  const cosine = Math.cos(moments.rotationRad);
  const sine = Math.sin(moments.rotationRad);
  let radiusMajor = 0;
  let radiusMinor = 0;
  for (const point of points) {
    const dx = point.x - moments.centerX;
    const dy = point.y - moments.centerY;
    radiusMajor = Math.max(radiusMajor, Math.abs(cosine * dx + sine * dy));
    radiusMinor = Math.max(radiusMinor, Math.abs(-sine * dx + cosine * dy));
  }
  radiusMajor = Math.max(1, radiusMajor - 1);
  radiusMinor = Math.max(1, radiusMinor - 1);
  if (!Number.isFinite(radiusMajor) || !Number.isFinite(radiusMinor) || radiusMinor <= 0) return null;
  const residuals: number[] = [];
  const sectors = new Uint8Array(72);
  for (const point of points) {
    const dx = point.x - moments.centerX;
    const dy = point.y - moments.centerY;
    const major = cosine * dx + sine * dy;
    const minor = -sine * dx + cosine * dy;
    const normalized = Math.hypot(major / radiusMajor, minor / radiusMinor);
    residuals.push(Math.abs(normalized - 1) * radiusMinor);
    const angle = Math.atan2(minor / radiusMinor, major / radiusMajor);
    sectors[Math.min(71, Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 72))] = 1;
  }
  const visibleArcFraction = sectors.reduce((sum, value) => sum + value, 0) / sectors.length;
  const fitResidualPx95 = percentile(residuals, 0.95);
  const confidence = clamp(visibleArcFraction * Math.exp(-fitResidualPx95 / 4), 0, 1);
  return {
    ellipse: {
      centerX: moments.centerX,
      centerY: moments.centerY,
      radiusMajor,
      radiusMinor,
      rotationRad: normalizeHalfTurn(moments.rotationRad),
      fitResidualPx95,
      visibleArcFraction,
      confidence,
    },
    residuals,
  };
}

function pointMoments(points: WheelEdgePoint[]) {
  if (points.length === 0) return null;
  const minimumX = Math.min(...points.map((point) => point.x));
  const maximumX = Math.max(...points.map((point) => point.x));
  const minimumY = Math.min(...points.map((point) => point.y));
  const maximumY = Math.max(...points.map((point) => point.y));
  const centerX = (minimumX + maximumX) / 2;
  const centerY = (minimumY + maximumY) / 2;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const point of points) {
    const x = point.x - centerX;
    const y = point.y - centerY;
    xx += x * x;
    yy += y * y;
    xy += x * y;
  }
  xx /= points.length;
  yy /= points.length;
  xy /= points.length;
  const trace = xx + yy;
  const spread = Math.hypot(xx - yy, 2 * xy);
  const lambdaMajor = (trace + spread) / 2;
  const lambdaMinor = (trace - spread) / 2;
  if (lambdaMinor <= 0 || lambdaMajor <= 0) return null;
  return { centerX, centerY, lambdaMajor, lambdaMinor, rotationRad: 0.5 * Math.atan2(2 * xy, xx - yy) };
}

function estimateAngularSpan(points: WheelEdgePoint[], moments: NonNullable<ReturnType<typeof pointMoments>>): number {
  const cosine = Math.cos(moments.rotationRad);
  const sine = Math.sin(moments.rotationRad);
  const bins = new Uint8Array(72);
  for (const point of points) {
    const dx = point.x - moments.centerX;
    const dy = point.y - moments.centerY;
    const angle = Math.atan2(-sine * dx + cosine * dy, cosine * dx + sine * dy);
    bins[Math.min(71, Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 72))] = 1;
  }
  return (bins.reduce((sum, value) => sum + value, 0) / bins.length) * Math.PI * 2;
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
