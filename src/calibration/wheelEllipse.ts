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

function normalizeHalfTurn(angle: number): number {
  const normalized = angle % Math.PI;
  return normalized < 0 ? normalized + Math.PI : normalized;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
