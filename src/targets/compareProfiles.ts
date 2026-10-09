import type { StableDimensionReading } from "../measurement/types";
import type { ProfileComparison, ProfileRegion, RegionalProfileError, TargetProfile } from "./types";

const REGION_RANGES: Array<{ region: ProfileRegion; start: number; end: number }> = [
  { region: "base", start: 0, end: 0.1 },
  { region: "lower-body", start: 0.1, end: 0.5 },
  { region: "upper-body", start: 0.5, end: 0.9 },
  { region: "rim", start: 0.9, end: 1.001 },
];

export function compareProfiles(reading: StableDimensionReading, target: TargetProfile): ProfileComparison {
  const rows = target.normalizedRadiusByHeight.map((targetSample) => {
    const sourceIndex = Math.round(targetSample.heightRatio * (reading.profile.length - 1));
    const current = reading.profile[sourceIndex];
    const targetRadius = targetSample.radiusToHeightRatio * target.intendedWetHeightMm;
    const currentRadius = current?.radiusMm ?? null;
    return {
      ratio: targetSample.heightRatio,
      targetRadius,
      currentRadius,
      confidence: current?.confidence ?? 0,
      error: currentRadius === null ? null : currentRadius - targetRadius,
    };
  });
  const valid = rows.filter((row): row is typeof row & { currentRadius: number; error: number } => row.error !== null && row.currentRadius !== null);
  const coverage = valid.length / rows.length;
  const regions: RegionalProfileError[] = REGION_RANGES.map(({ region, start, end }) => {
    const candidates = rows.filter((row) => row.ratio >= start && row.ratio < end);
    const available = candidates.filter((row): row is typeof row & { currentRadius: number; error: number } => row.error !== null && row.currentRadius !== null);
    const regionalCoverage = available.length / candidates.length;
    const eligible = regionalCoverage >= 0.7;
    return {
      region,
      signedMedianRadiusErrorMm: eligible ? median(available.map((row) => row.error)) : null,
      meanAbsoluteRadiusErrorMm: eligible ? mean(available.map((row) => Math.abs(row.error))) : null,
      coverage: regionalCoverage,
      confidence: eligible ? Math.min(reading.confidence.overall, target.confidence, mean(available.map((row) => row.confidence))) : 0,
    };
  });
  const intersection = valid.reduce((sum, row) => sum + Math.min(row.currentRadius, row.targetRadius), 0);
  const union = valid.reduce((sum, row) => sum + Math.max(row.currentRadius, row.targetRadius), 0);
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `comparison-${reading.id}-${target.id}`,
    timestampMs: reading.timestampMs,
    readingId: reading.id,
    targetId: target.id,
    meanAbsoluteRadiusErrorMm: coverage >= 0.7 ? mean(valid.map((row) => Math.abs(row.error))) : null,
    normalizedSilhouetteIoU: coverage >= 0.7 && union > 0 ? intersection / union : null,
    regions,
    confidence: reading.confidence,
  };
}

function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
