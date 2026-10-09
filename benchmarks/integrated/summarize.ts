import { monotonicGrowth, quantile } from "../shared/stats";
export type IntegratedResult = { cameraOnlyHz: number; integratedHz: number; frameAgesMs: number[];
  pendingFrames: number[]; recorderQueue: number[]; memoryBytes: number[] };
export function summarizeIntegrated(result: IntegratedResult) {
  const retention = result.cameraOnlyHz ? result.integratedHz / result.cameraOnlyHz : 0;
  const frameAgeP95 = quantile(result.frameAgesMs, 0.95);
  return { rateRetention: retention, frameAgeP95, maxPendingFrames: Math.max(0, ...result.pendingFrames),
    maxRecorderQueue: Math.max(0, ...result.recorderQueue), monotonicMemoryGrowth: monotonicGrowth(result.memoryBytes),
    gates: { rateRetention: retention >= 0.8, frameAge: frameAgeP95 !== null && frameAgeP95 <= 500,
      pendingFrames: Math.max(0, ...result.pendingFrames) <= 1, recorderQueue: Math.max(0, ...result.recorderQueue) <= 100,
      memory: !monotonicGrowth(result.memoryBytes) } };
}
