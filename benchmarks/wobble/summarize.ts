import { ratio } from "../shared/stats";
export type WobbleResult = { expectedSignificant: boolean; predictedSignificant: boolean; amplitudeMm: number;
  delayRevolutions: number | null; cameraNegative: boolean };
export function summarizeWobble(rows: WobbleResult[], durationMinutes: number) {
  const predicted = rows.filter((row) => row.predictedSignificant);
  const positives = rows.filter((row) => row.expectedSignificant);
  const tenMm = positives.filter((row) => row.amplitudeMm >= 10);
  const camera = rows.filter((row) => row.cameraNegative);
  const precision = ratio(predicted.filter((row) => row.expectedSignificant).length, predicted.length) ?? 0;
  const falseAlertsPer10Min = durationMinutes ? predicted.filter((row) => !row.expectedSignificant).length * 10 / durationMinutes : Infinity;
  const delays = positives.flatMap((row) => row.delayRevolutions == null ? [] : [row.delayRevolutions]);
  const delay = delays.length ? Math.max(...delays) : Infinity;
  const recall = ratio(tenMm.filter((row) => row.predictedSignificant).length, tenMm.length) ?? 0;
  const cameraSuppression = ratio(camera.filter((row) => !row.predictedSignificant).length, camera.length) ?? 0;
  return { precision, falseAlertsPer10Min, maxDelayRevolutions: delay, recallAt10Mm: recall, cameraSuppression,
    gates: { precision: precision >= 0.9, falseAlerts: falseAlertsPer10Min <= 1, delay: delay <= 3,
      recallAt10Mm: recall >= 0.9, cameraSuppression: cameraSuppression >= 0.95 } };
}
