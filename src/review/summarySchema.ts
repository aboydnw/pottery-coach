import { z } from "zod";

const supportedValue = z.object({ heightMm: z.number().nullable(), maximumWidthMm: z.number().nullable(), evidenceIds: z.array(z.string()) });
export const sessionSummarySchema = z.object({
  schemaVersion: z.literal(1), sessionId: z.string(),
  peak: supportedValue, final: supportedValue,
  unmeasurableDurationMs: z.number().nonnegative(),
  eventCounts: z.record(z.string(), z.number().int().nonnegative()),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
