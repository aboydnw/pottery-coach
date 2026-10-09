import type { DimensionReading } from "../measurement/types";
import type { TemporalContourSample } from "./types";

export function contourSampleFromReading(reading: DimensionReading, bands = 7): TemporalContourSample {
  const centersMm: Array<number | null> = [], leftMm: Array<number | null> = [], rightMm: Array<number | null> = [];
  for (let band = 0; band < bands; band++) {
    const ratio = bands === 1 ? 0.5 : band / (bands - 1);
    const sample = reading.profile[Math.round(ratio * (reading.profile.length - 1))];
    const radius = sample?.radiusMm ?? null;
    const center = radius === null ? null : reading.centerlineOffsetMm ?? 0;
    centersMm.push(center); leftMm.push(center === null || radius === null ? null : center - radius);
    rightMm.push(center === null || radius === null ? null : center + radius);
  }
  const valid = centersMm.filter((value) => value !== null).length / Math.max(1, bands);
  return { timestampMs: reading.timestampMs, frameId: reading.sourceFrameId, centersMm, leftMm, rightMm,
    rimCenterMm: centersMm.at(-1) ?? null, rimHeightMm: reading.heightMm,
    cameraTransformConfidence: reading.confidence.calibration.score, occluded: valid < 0.7, shapeChangeRate: 0 };
}
