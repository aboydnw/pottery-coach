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

export type WheelEllipseCandidate = WheelEllipse & { score: number };

type GrayImage = { gray: Float32Array; width: number; height: number };

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

/** Finds complete circular surfaces projected as ellipses in the lower part of a frame. */
export function detectWheelEllipses(image: GrayImage): WheelEllipseCandidate[] {
  const { gray, width, height } = image;
  if (gray.length !== width * height || width < 8 || height < 8) return [];
  const mean = gray.reduce((sum, value) => sum + value, 0) / gray.length;
  const variance = gray.reduce((sum, value) => sum + (value - mean) ** 2, 0) / gray.length;
  const deviation = Math.sqrt(variance) * 0.6;
  const masks = [
    Uint8Array.from(gray, (value) => (value < mean - deviation ? 1 : 0)),
    Uint8Array.from(gray, (value) => (value > mean + deviation ? 1 : 0)),
  ];
  const candidates: WheelEllipseCandidate[] = [];
  for (const mask of masks) findCandidates(mask, width, height, candidates);
  return candidates.sort((left, right) => right.score - left.score).slice(0, 3);
}

function findCandidates(mask: Uint8Array, width: number, height: number, candidates: WheelEllipseCandidate[]): void {
  const labels = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  for (let start = Math.floor(height * 0.3) * width; start < mask.length; start += 1) {
    if (!mask[start] || labels[start]) continue;
    let head = 0;
    let tail = 0;
    let touchesFrame = false;
    queue[tail++] = start;
    labels[start] = 1;
    let sumX = 0;
    let sumY = 0;
    while (head < tail) {
      const index = queue[head++]!;
      const x = index % width;
      const y = (index - x) / width;
      sumX += x;
      sumY += y;
      touchesFrame ||= x === 0 || y === 0 || x === width - 1 || y === height - 1;
      for (const neighbor of [index - 1, index + 1, index - width, index + width]) {
        if (neighbor < 0 || neighbor >= mask.length || labels[neighbor] || !mask[neighbor]) continue;
        const nx = neighbor % width;
        if (Math.abs(nx - x) > 1) continue;
        labels[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    if (touchesFrame || tail < width * height * 0.01) continue;
    const centerX = sumX / tail;
    const centerY = sumY / tail;
    let xx = 0;
    let yy = 0;
    let xy = 0;
    for (let i = 0; i < tail; i += 1) {
      const index = queue[i]!;
      const x = (index % width) - centerX;
      const y = (index - (index % width)) / width - centerY;
      xx += x * x;
      yy += y * y;
      xy += x * y;
    }
    xx /= tail;
    yy /= tail;
    xy /= tail;
    const trace = xx + yy;
    const spread = Math.hypot(xx - yy, 2 * xy);
    const lambdaMajor = (trace + spread) / 2;
    const lambdaMinor = (trace - spread) / 2;
    if (lambdaMinor <= 0) continue;
    const rotationRad = 0.5 * Math.atan2(2 * xy, xx - yy);
    const radiusMajor = 2 * Math.sqrt(lambdaMajor);
    const radiusMinor = 2 * Math.sqrt(lambdaMinor);
    const boundary = boundaryFit(mask, queue, tail, width, centerX, centerY, radiusMajor, radiusMinor, rotationRad);
    const confidence = clamp(Math.exp(-boundary.residualPx95 / 4) * boundary.arcFraction, 0, 1);
    const ellipse = canonicalWheelEllipse({
      centerX,
      centerY,
      radiusMajor,
      radiusMinor,
      rotationRad,
      fitResidualPx95: boundary.residualPx95,
      visibleArcFraction: boundary.arcFraction,
      confidence,
    });
    candidates.push({ ...ellipse, score: confidence * tail });
  }
}

function boundaryFit(
  mask: Uint8Array,
  pixels: Int32Array,
  count: number,
  width: number,
  centerX: number,
  centerY: number,
  radiusMajor: number,
  radiusMinor: number,
  rotation: number,
): { residualPx95: number; arcFraction: number } {
  const residuals: number[] = [];
  const bins = new Uint8Array(36);
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  for (let i = 0; i < count; i += 1) {
    const index = pixels[i]!;
    if (mask[index - 1] && mask[index + 1] && mask[index - width] && mask[index + width]) continue;
    const dx = (index % width) - centerX;
    const dy = (index - (index % width)) / width - centerY;
    const major = cosine * dx + sine * dy;
    const minor = -sine * dx + cosine * dy;
    const normalized = Math.hypot(major / radiusMajor, minor / radiusMinor);
    residuals.push(Math.abs(normalized - 1) * Math.min(radiusMajor, radiusMinor));
    const angle = Math.atan2(minor / radiusMinor, major / radiusMajor);
    bins[Math.min(35, Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 36))] = 1;
  }
  residuals.sort((a, b) => a - b);
  return {
    residualPx95: residuals[Math.floor(residuals.length * 0.95)] ?? Number.POSITIVE_INFINITY,
    arcFraction: bins.reduce((sum, value) => sum + value, 0) / bins.length,
  };
}

function normalizeHalfTurn(angle: number): number {
  const normalized = angle % Math.PI;
  return normalized < 0 ? normalized + Math.PI : normalized;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
