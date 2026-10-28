export type ClaySegmentationMetrics = {
  intersectionOverUnion: number;
  medianBoundaryErrorMm: number;
  p95BoundaryErrorMm: number;
  noClayFalsePositiveRate: number;
  occlusionSuppressionRecall: number;
  latencyP95Ms: number;
};

export type ClayEvaluationSample = {
  truth: Uint8Array;
  predicted: Uint8Array;
  boundaryErrorsMm: number[];
  noClay: boolean;
  occludedFraction: number;
  measurementSuppressed: boolean;
  latencyMs: number;
};

export function summarizeClaySegmentation(samples: ClayEvaluationSample[]): ClaySegmentationMetrics {
  if (samples.length === 0) throw new Error("At least one clay evaluation sample is required");
  let intersection = 0;
  let union = 0;
  const boundaryErrors: number[] = [];
  const noClay = samples.filter((sample) => sample.noClay);
  const occluded = samples.filter((sample) => sample.occludedFraction > 0.3);
  for (const sample of samples) {
    if (sample.truth.length !== sample.predicted.length) throw new Error("Truth and predicted masks must match");
    for (let index = 0; index < sample.truth.length; index += 1) {
      const truth = sample.truth[index] !== 0;
      const predicted = sample.predicted[index] !== 0;
      if (truth && predicted) intersection += 1;
      if (truth || predicted) union += 1;
    }
    boundaryErrors.push(...sample.boundaryErrorsMm);
  }
  const falsePositiveScenes = noClay.filter((sample) => sample.predicted.some((value) => value !== 0)).length;
  const suppressedOcclusions = occluded.filter((sample) => sample.measurementSuppressed).length;
  return {
    intersectionOverUnion: union === 0 ? 1 : intersection / union,
    medianBoundaryErrorMm: percentile(boundaryErrors, 0.5),
    p95BoundaryErrorMm: percentile(boundaryErrors, 0.95),
    noClayFalsePositiveRate: noClay.length === 0 ? 0 : falsePositiveScenes / noClay.length,
    occlusionSuppressionRecall: occluded.length === 0 ? 1 : suppressedOcclusions / occluded.length,
    latencyP95Ms: percentile(
      samples.map((sample) => sample.latencyMs),
      0.95,
    ),
  };
}

export function passesClayModelGate(metrics: ClaySegmentationMetrics): boolean {
  return (
    metrics.intersectionOverUnion >= 0.85 &&
    metrics.medianBoundaryErrorMm <= 6 &&
    metrics.p95BoundaryErrorMm <= 12.7 &&
    metrics.noClayFalsePositiveRate <= 0.02 &&
    metrics.occlusionSuppressionRecall >= 0.95 &&
    metrics.latencyP95Ms < 150
  );
}

export function assertDisjointSessions(training: string[], evaluation: string[]): string[] {
  const train = new Set(training);
  return [...new Set(evaluation.filter((id) => train.has(id)))].sort();
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(fraction * sorted.length) - 1]!;
}
