import type { DimensionReading } from "../measurement/types";

/** About half a second of frames at the usual processing rate. */
const WINDOW_SIZE = 5;
/** Frame-to-frame spread (relative to the median) that a spinning pot alone doesn't produce. */
const JITTER_ON = 0.06;
const JITTER_OFF = 0.03;
/** Sudden growth against the last hands-off outline. */
const GROWTH_ON = 0.15;
/** How long the outline must stay steady before readings are trusted again. */
const RELEASE_MS = 1_000;

type Outline = { width: number; height: number };

/**
 * Guesses when hands are on the pot. A pot spinning on a wheel keeps a steady outline; hands make it
 * jump around and suddenly grow. Readings taken while this is on aren't trusted, and cues wait.
 */
export class HandsDetector {
  private window: Outline[] = [];
  private baseline: Outline | null = null;
  private handsOn = false;
  private steadySinceMs: number | null = null;

  /** Feeds one instantaneous reading and returns whether hands are likely on the pot. */
  update(reading: DimensionReading): boolean {
    if (reading.height === null || reading.maximumWidth === null) return this.handsOn;
    const outline = { width: reading.maximumWidth, height: reading.height };
    this.window = [...this.window, outline].slice(-WINDOW_SIZE);
    const jitter = Math.max(
      spread(this.window.map((item) => item.width)),
      spread(this.window.map((item) => item.height)),
    );
    if (!this.handsOn) {
      const grew =
        this.baseline !== null &&
        (outline.width > this.baseline.width * (1 + GROWTH_ON) ||
          outline.height > this.baseline.height * (1 + GROWTH_ON));
      if (this.window.length >= 2 && (jitter > JITTER_ON || grew)) {
        this.handsOn = true;
        this.steadySinceMs = null;
      } else if (this.window.length === WINDOW_SIZE) {
        this.baseline = median(this.window);
      }
      return this.handsOn;
    }
    if (jitter > JITTER_OFF) {
      this.steadySinceMs = null;
      return true;
    }
    this.steadySinceMs ??= reading.timestampMs;
    if (reading.timestampMs - this.steadySinceMs >= RELEASE_MS) {
      this.handsOn = false;
      this.baseline = median(this.window);
    }
    return this.handsOn;
  }

  reset(): void {
    this.window = [];
    this.baseline = null;
    this.handsOn = false;
    this.steadySinceMs = null;
  }
}

function spread(values: number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted[Math.floor(sorted.length / 2)]!;
  return middle > 0 ? (sorted.at(-1)! - sorted[0]!) / middle : 0;
}

function median(outlines: Outline[]): Outline {
  const pick = (values: number[]) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)]!;
  return { width: pick(outlines.map((item) => item.width)), height: pick(outlines.map((item) => item.height)) };
}
