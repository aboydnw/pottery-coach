/**
 * Milliseconds since the Unix epoch with sub-millisecond precision.
 * Uses `performance.timeOrigin`, so main-thread and worker timestamps share one clock domain
 * and can be stored alongside `Date.now()` values.
 */
export function epochNow(): number {
  return performance.timeOrigin + performance.now();
}

/** Converts a `performance.now()`-style timestamp from this realm to epoch milliseconds. */
export function toEpochMs(highResolutionTimestamp: number): number {
  return performance.timeOrigin + highResolutionTimestamp;
}
