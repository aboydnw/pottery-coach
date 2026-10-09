import type { SessionBundle } from "../session/types";
import { sessionSummarySchema, type SessionSummary } from "./summarySchema";

export function buildSummary(bundle: SessionBundle): SessionSummary {
  const reliable = bundle.readings.filter((reading) => reading.confidence >= 0.7);
  const byHeight = [...reliable].filter((reading) => reading.values.heightMm != null)
    .sort((a, b) => (b.values.heightMm ?? -Infinity) - (a.values.heightMm ?? -Infinity));
  const peakReading = byHeight[0];
  const finalReading = reliable.at(-1);
  const eventCounts = Object.fromEntries([...new Set(bundle.events.map((event) => event.type))]
    .sort().map((type) => [type, bundle.events.filter((event) => event.type === type).length]));
  const unmeasurableDurationMs = bundle.readings.reduce((total, reading, index) => {
    if (reading.confidence >= 0.7) return total;
    const end = bundle.readings[index + 1]?.timestampMs ?? bundle.session.endedAtMs ?? reading.timestampMs;
    return total + Math.max(0, end - reading.timestampMs);
  }, 0);
  const milestones = bundle.events.filter((event) => event.type === "goal-milestone" && typeof event.payload.percent === "number" && event.evidenceIds.length)
    .map((event) => ({ percent: event.payload.percent as number, timestampMs: event.timestampMs, evidenceIds: [...event.evidenceIds] }));
  const summary = {
    schemaVersion: 1 as const, sessionId: bundle.session.id,
    peak: { heightMm: peakReading?.values.heightMm ?? null, maximumWidthMm: peakReading?.values.maximumWidthMm ?? null, evidenceIds: peakReading ? [peakReading.id] : [] },
    final: { heightMm: finalReading?.values.heightMm ?? null, maximumWidthMm: finalReading?.values.maximumWidthMm ?? null, evidenceIds: finalReading ? [finalReading.id] : [] },
    unmeasurableDurationMs, milestones, eventCounts,
  };
  return sessionSummarySchema.parse(summary);
}
