import { z } from "zod";

import type { ThrowingGoal } from "../../goals/types";
import type { ToolDependencies } from "./types";

const goalSchema = z.object({
  id: z.string().min(1), targetId: z.string().min(1), basis: z.enum(["wet", "fired"]),
  desiredHeightMm: z.number().positive(), desiredMaximumWidthMm: z.number().positive().nullable(),
  shrinkageFraction: z.number().min(0).max(0.25).nullable(),
});
const emptySchema = z.object({}).strict();

export function createToolRegistry(dependencies: ToolDependencies) {
  return {
    async call(name: string, input: unknown): Promise<unknown> {
      if (name === "setGoal") return dependencies.setGoal(parse(goalSchema, input) as ThrowingGoal);
      if (name === "getCurrentDimensions") {
        parse(emptySchema, input);
        const reading = dependencies.getDimensions();
        if (!reading) return { measurable: false, reason: "NO_CURRENT_READING", timestampMs: dependencies.now(), confidence: 0 };
        const freshnessMs = dependencies.now() - reading.timestampMs;
        if (freshnessMs > 750 || reading.confidence.overall < 0.8) return { measurable: false, reason: freshnessMs > 750 ? "STALE_READING" : "LOW_CONFIDENCE", evidenceId: reading.id, timestampMs: reading.timestampMs, confidence: reading.confidence.overall };
        return { measurable: true, evidenceId: reading.id, timestampMs: reading.timestampMs, confidence: reading.confidence.overall, freshnessMs, heightMm: round(reading.heightMm), maximumWidthMm: round(reading.maximumWidthMm), rimWidthMm: round(reading.rimWidthMm), baseWidthMm: round(reading.baseWidthMm) };
      }
      if (name === "getWobbleStatus") { parse(emptySchema, input); const value = dependencies.getWobble(); return value ? { evidenceId: value.id, timestampMs: value.timestampMs, confidence: value.confidence, classification: value.classification, amplitudeMm: round(value.amplitudeMm), reasons: value.reasons } : { measurable: false, reason: "NO_WOBBLE_EVIDENCE", timestampMs: dependencies.now(), confidence: 0 }; }
      if (name === "compareTargetProfile") { parse(emptySchema, input); const value = dependencies.getComparison(); return value ? { evidenceId: value.id, timestampMs: value.timestampMs, confidence: value.confidence.overall, meanAbsoluteRadiusErrorMm: round(value.meanAbsoluteRadiusErrorMm), regions: value.regions } : { measurable: false, reason: "NO_PROFILE_COMPARISON", timestampMs: dependencies.now(), confidence: 0 }; }
      if (name === "getMeasurementConfidence") { parse(emptySchema, input); const value = dependencies.getDimensions(); return value ? { evidenceId: value.id, timestampMs: value.timestampMs, confidence: value.confidence } : { measurable: false, reason: "NO_CURRENT_READING", timestampMs: dependencies.now(), confidence: 0 }; }
      if (name === "pauseCoaching") { parse(emptySchema, input); dependencies.setPaused(true); return { paused: true, timestampMs: dependencies.now() }; }
      if (name === "resumeCoaching") { parse(emptySchema, input); dependencies.setPaused(false); return { paused: false, timestampMs: dependencies.now() }; }
      if (name === "markMoment") return dependencies.markMoment(z.object({ label: z.string().max(100).optional() }).parse(input));
      throw new Error(`Unknown tool: ${name}`);
    },
  };
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid tool arguments: ${result.error.message}`);
  return result.data;
}
function round(value: number | null): number | null { return value === null ? null : Math.round(value * 10) / 10; }
