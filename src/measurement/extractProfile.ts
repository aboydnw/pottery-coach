import type { DimensionReading, MeasurementConfidence, ProfileSample } from "./types";
import { median, percentile } from "../shared/stats";

type ExtractionContext = {
  width: number;
  height: number;
  /** Size of one mask pixel in the output unit (e.g. full-resolution pixels per processed pixel). */
  unitsPerPixel: number;
  unit: DimensionReading["unit"];
  centerlineX: number;
  calibrationId: string;
  frameId: number;
  timestampMs: number;
  confidence?: MeasurementConfidence;
};

export function extractDimensions(
  mask: Uint8Array,
  rowReliability: Uint8Array,
  context: ExtractionContext,
): DimensionReading {
  const rows: Array<{ y: number; left: number; right: number; width: number; center: number }> = [];
  for (let y = 0; y < context.height; y += 1) {
    if (!rowReliability[y]) continue;
    let left = context.width;
    let right = -1;
    for (let x = 0; x < context.width; x += 1)
      if (mask[y * context.width + x]) {
        left = Math.min(left, x);
        right = x;
      }
    if (right >= left) rows.push({ y, left, right, width: right - left + 1, center: (left + right) / 2 });
  }
  const top = rows[0]?.y;
  const bottom = rows.at(-1)?.y;
  const widths = rows.map((row) => row.width * context.unitsPerPixel);
  const bandSize = Math.max(1, Math.ceil(rows.length * 0.1));
  const profile: ProfileSample[] = Array.from({ length: 64 }, (_, index) => {
    if (top === undefined || bottom === undefined) return { heightRatio: index / 63, radius: null, confidence: 0 };
    const y = Math.round(bottom - (index / 63) * (bottom - top));
    const row = rows.find((candidate) => candidate.y === y);
    return {
      heightRatio: index / 63,
      radius: row ? (row.width * context.unitsPerPixel) / 2 : null,
      confidence: row ? 1 : 0,
    };
  });
  const offsets = rows.map((row) => Math.abs(row.center - context.centerlineX) * context.unitsPerPixel);
  const confidence = context.confidence ?? defaultConfidence(rows.length > 0 ? 1 : 0);
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `reading-${context.frameId}`,
    timestampMs: context.timestampMs,
    sourceFrameId: context.frameId,
    calibrationId: context.calibrationId,
    unit: context.unit,
    height: top === undefined || bottom === undefined ? null : (bottom - top + 1) * context.unitsPerPixel,
    maximumWidth: widths.length ? percentile(widths, 0.95) : null,
    rimWidth: widths.length ? median(widths.slice(0, bandSize)) : null,
    baseWidth: widths.length ? median(widths.slice(-bandSize)) : null,
    centerlineOffset: offsets.length
      ? median(rows.map((row) => (row.center - context.centerlineX) * context.unitsPerPixel))
      : null,
    profile,
    visibleAsymmetry: offsets.length ? median(offsets) : null,
    confidence,
  };
}

function defaultConfidence(score: number): MeasurementConfidence {
  const component = { score, reasons: score ? [] : ["NO_RELIABLE_ROWS"] };
  return {
    overall: score,
    calibration: component,
    segmentation: component,
    occlusion: component,
    temporalStability: component,
    freshnessMs: 0,
    estimatedError95: null,
  };
}
