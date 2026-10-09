import { z } from "zod";

const supportedValue = z.object({ heightMm: z.number().nullable(), maximumWidthMm: z.number().nullable(), evidenceIds: z.array(z.string()) });
export const sessionSummarySchema = z.object({
  schemaVersion: z.literal(1), sessionId: z.string(),
  peak: supportedValue, final: supportedValue,
  unmeasurableDurationMs: z.number().nonnegative(),
  milestones: z.array(z.object({ percent: z.number(), timestampMs: z.number(), evidenceIds: z.array(z.string()).min(1) })),
  eventCounts: z.record(z.string(), z.number().int().nonnegative()),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
