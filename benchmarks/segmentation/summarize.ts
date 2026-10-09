import { quantile, ratio } from "../shared/stats";
export type SegmentationResult = { boundaryErrorMm: number | null; occlusionFraction: number; measurable: boolean };
export function summarizeSegmentation(rows: SegmentationResult[]) {
  const errors = rows.flatMap((row) => row.boundaryErrorMm == null ? [] : [Math.abs(row.boundaryErrorMm)]);
  const occluded = rows.filter((row) => row.occlusionFraction > 0.3);
  const medianBoundaryMm = quantile(errors, 0.5), p95BoundaryMm = quantile(errors, 0.95);
  const recall = ratio(occluded.filter((row) => !row.measurable).length, occluded.length);
  return { medianBoundaryMm, p95BoundaryMm, occlusionUnmeasurableRecall: recall,
    gates: { medianBoundary: medianBoundaryMm !== null && medianBoundaryMm <= 3,
      p95Boundary: p95BoundaryMm !== null && p95BoundaryMm <= 10,
      occlusionUnmeasurableRecall: recall !== null && recall >= 0.95 } };
}
