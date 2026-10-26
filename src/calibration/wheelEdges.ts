export type GrayImage = { gray: Float32Array; width: number; height: number };

export type WheelCaptureReason = "BLURRY" | "LOW_CONTRAST" | "GLARE";

export type WheelCaptureQuality = {
  blurScore: number;
  contrastScore: number;
  glareFraction: number;
  reasons: WheelCaptureReason[];
};

export type WheelEdgePoint = {
  x: number;
  y: number;
  strength: number;
  normalX: number;
  normalY: number;
  polarity: -1 | 1;
};

export type WheelEdgeMap = {
  width: number;
  height: number;
  points: WheelEdgePoint[];
  quality: WheelCaptureQuality;
};

const SEARCH_TOP_FRACTION = 0.3;

/** Extracts locally meaningful rim edges without assuming whether the wheel is light or dark. */
export function extractWheelEdges(image: GrayImage): WheelEdgeMap {
  const { gray, width, height } = image;
  if (width < 8 || height < 8 || gray.length !== width * height) return empty(width, height);
  const top = Math.floor(height * SEARCH_TOP_FRACTION);
  let minimum = 255;
  let maximum = 0;
  let glare = 0;
  let count = 0;
  for (let y = top; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = gray[y * width + x]!;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
      if (value >= 250) glare += 1;
      count += 1;
    }
  }
  const contrastScore = (maximum - minimum) / 255;
  const glareFraction = glare / Math.max(1, count);
  const strengths: number[] = [];
  const gx = new Float32Array(gray.length);
  const gy = new Float32Array(gray.length);
  const magnitude = new Float32Array(gray.length);
  for (let y = Math.max(1, top); y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const horizontal = gray[index + 1]! - gray[index - 1]!;
      const vertical = gray[index + width]! - gray[index - width]!;
      const strength = Math.hypot(horizontal, vertical);
      gx[index] = horizontal;
      gy[index] = vertical;
      magnitude[index] = strength;
      if (strength > 0) strengths.push(strength);
    }
  }
  strengths.sort((a, b) => a - b);
  const strongThreshold = Math.max(6, strengths[Math.floor(strengths.length * 0.7)] ?? 255);
  const blurScore = Math.min(1, (strengths[Math.floor(strengths.length * 0.9)] ?? 0) / 48);
  const reasons: WheelCaptureReason[] = [];
  if (contrastScore < 0.06) reasons.push("LOW_CONTRAST");
  if (strengths.length > 0 && blurScore < 0.12) reasons.push("BLURRY");
  if (glareFraction > 0.15) reasons.push("GLARE");
  if (reasons.includes("LOW_CONTRAST")) {
    return { width, height, points: [], quality: { blurScore, contrastScore, glareFraction, reasons } };
  }

  const points: WheelEdgePoint[] = [];
  for (let y = Math.max(1, top); y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const strength = magnitude[index]!;
      if (strength < strongThreshold) continue;
      const horizontal = gx[index]!;
      const vertical = gy[index]!;
      const compareHorizontal = Math.abs(horizontal) >= Math.abs(vertical);
      const before = magnitude[index - (compareHorizontal ? 1 : width)]!;
      const after = magnitude[index + (compareHorizontal ? 1 : width)]!;
      if (strength < before || strength < after) continue;
      points.push({
        x,
        y,
        strength,
        normalX: horizontal / strength,
        normalY: vertical / strength,
        polarity: horizontal + vertical >= 0 ? 1 : -1,
      });
    }
  }
  return { width, height, points, quality: { blurScore, contrastScore, glareFraction, reasons } };
}

function empty(width: number, height: number): WheelEdgeMap {
  return {
    width,
    height,
    points: [],
    quality: { blurScore: 0, contrastScore: 0, glareFraction: 0, reasons: ["LOW_CONTRAST"] },
  };
}
