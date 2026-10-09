import type { FitResult } from "./fitOscillation";
import type { TemporalContourSample, WobbleClassification, WobbleReading } from "./types";

export function classifyWobble(
  window: TemporalContourSample[],
  fit: FitResult,
  context: { periodMs: number; cameraMotionRmsMm: number | null },
): WobbleReading {
  const valid = window.filter((sample) => !sample.occluded);
  const validSampleFraction = window.length ? valid.length / window.length : 0;
  const cameraConfidence = valid.length ? valid.reduce((sum, sample) => sum + sample.cameraTransformConfidence, 0) / valid.length : 0;
  const duration = window.length > 1 ? window.at(-1)!.timestampMs - window[0]!.timestampMs : 0;
  const observedRevolutions = duration / context.periodMs;
  const reasons: string[] = [];
  if (validSampleFraction < 0.7) reasons.push("OCCLUSION");
  if (cameraConfidence < 0.8) reasons.push("CAMERA_TRANSFORM_LOW_CONFIDENCE");
  if (valid.some((sample) => sample.shapeChangeRate > 0.15)) reasons.push("ACTIVE_SHAPING");
  if (observedRevolutions < 3) reasons.push("INSUFFICIENT_REVOLUTIONS");
  if (context.cameraMotionRmsMm !== null && context.cameraMotionRmsMm > 2) reasons.push("CAMERA_MOTION_RESIDUAL");
  if (fit.amplitudeMm <= 3 * fit.residualRmsMm) reasons.push("BELOW_NOISE_FLOOR");
  const confidence = Math.min(validSampleFraction, cameraConfidence, Math.min(1, fit.amplitudeMm / Math.max(0.001, 3 * fit.residualRmsMm)));
  let classification: WobbleClassification = "unmeasurable";
  if (reasons.length === 0 && confidence >= 0.85) {
    classification = fit.amplitudeMm >= 5 ? "significant-visible-oscillation" : fit.amplitudeMm >= 2 ? "minor-visible-oscillation" : "visually-stable";
  }
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `wobble-${window.at(-1)?.frameId ?? 0}`,
    timestampMs: window.at(-1)?.timestampMs ?? 0,
    amplitudeMm: classification === "unmeasurable" ? null : fit.amplitudeMm,
    periodMs: classification === "unmeasurable" ? null : context.periodMs,
    classification,
    confidence,
    evidenceWindowMs: duration,
    observedRevolutions,
    validSampleFraction,
    cameraMotionRmsMm: context.cameraMotionRmsMm,
    lastReliableTimestampMs: classification === "unmeasurable" ? null : window.at(-1)?.timestampMs ?? null,
    reasons,
    sourceFrameIds: window.map((sample) => sample.frameId),
  };
}
