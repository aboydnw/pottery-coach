import type { SessionScale } from "../measurement/scale";
import type { RecordedReading, SessionBundle } from "./types";

const LENGTH_KEYS = ["height", "maximumWidth", "rimWidth", "baseWidth"] as const;

/**
 * Gives every recorded reading `heightMm`-style values using the session's scale, so review,
 * summaries and exports read one shape for both schema versions. Pixel readings without a scale
 * get null sizes rather than guessed ones.
 */
export function resolveRecordedSizes(bundle: SessionBundle): SessionBundle {
  const scale = bundle.session.scale ?? null;
  return { ...bundle, readings: bundle.readings.map((reading) => resolveReading(reading, scale)) };
}

function resolveReading(reading: RecordedReading, scale: SessionScale | null): RecordedReading {
  if (reading.unit !== "px") return reading;
  const values: Record<string, number | null> = { ...reading.values };
  for (const key of LENGTH_KEYS) {
    const pixels = reading.values[key];
    values[`${key}Mm`] = pixels == null || !scale ? null : pixels * scale.mmPerPixel;
  }
  return { ...reading, values };
}

/** True when a session tracked shapes but never got a size scale. */
export function sizesUnavailable(bundle: SessionBundle): boolean {
  return !bundle.session.scale && bundle.readings.some((reading) => reading.unit === "px");
}
