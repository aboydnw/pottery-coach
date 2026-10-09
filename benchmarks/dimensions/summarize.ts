import { quantile, ratio } from "../shared/stats";
export type DimensionResult = { errorMm: number | null; supported: boolean; accepted: boolean };
export function summarizeDimensions(rows: DimensionResult[]) {
  const errors = rows.flatMap((row) => row.errorMm == null ? [] : [row.errorMm]);
  const absolute = errors.map(Math.abs);
  const medianMm = quantile(absolute, 0.5);
  const p95Mm = quantile(absolute, 0.95);
  const biasMm = errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null;
  const supported = rows.filter((row) => row.supported);
  const unsupported = rows.filter((row) => !row.supported);
  const supportedAcceptance = ratio(supported.filter((row) => row.accepted).length, supported.length);
  const unsupportedRejection = ratio(unsupported.filter((row) => !row.accepted).length, unsupported.length);
  return { medianMm, p95Mm, biasMm, supportedAcceptance, unsupportedRejection, gates: {
    median: medianMm !== null && medianMm <= 5, p95: p95Mm !== null && p95Mm <= 10,
    bias: biasMm !== null && Math.abs(biasMm) <= 5, supportedAcceptance: supportedAcceptance !== null && supportedAcceptance >= 0.95,
    unsupportedRejection: unsupportedRejection !== null && unsupportedRejection >= 0.95 } };
}
