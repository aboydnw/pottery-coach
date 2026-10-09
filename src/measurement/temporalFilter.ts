import type { DimensionReading, ProfileSample, StableDimensionReading } from "./types";

const WINDOW_SIZE = 5;
const EMA_TIME_CONSTANT_MS = 400;

export class TemporalFilter {
  private readings: DimensionReading[] = [];
  private smoothed: StableDimensionReading | null = null;

  constructor(private readonly now: () => number = () => performance.now()) {}

  push(reading: DimensionReading): StableDimensionReading | null {
    if (reading.confidence.overall < 0.75 || reading.heightMm === null) return null;
    if (this.isOutlier(reading.heightMm)) return this.buildStable(this.readings);
    this.readings.push(reading);
    if (this.readings.length > WINDOW_SIZE) this.readings.shift();
    if (this.readings.length < WINDOW_SIZE) return null;
    const stable = this.buildStable(this.readings);
    this.smoothed = stable;
    return stable;
  }

  reset(_reason: string): void {
    this.readings = [];
    this.smoothed = null;
  }

  private isOutlier(value: number): boolean {
    if (this.readings.length < WINDOW_SIZE) return false;
    const values = this.readings.map((reading) => reading.heightMm!).sort((a, b) => a - b);
    const center = median(values);
    const mad = median(values.map((item) => Math.abs(item - center)));
    return Math.abs(value - center) > Math.max(5, 3 * 1.4826 * mad);
  }

  private buildStable(readings: DimensionReading[]): StableDimensionReading | null {
    if (readings.length < WINDOW_SIZE) return null;
    const latest = readings.at(-1)!;
    const previous = this.smoothed;
    const dt = previous ? Math.max(0, latest.timestampMs - previous.timestampMs) : EMA_TIME_CONSTANT_MS;
    const alpha = previous ? dt / (EMA_TIME_CONSTANT_MS + dt) : 1;
    const smooth = (key: keyof Pick<DimensionReading, "heightMm" | "maximumWidthMm" | "rimWidthMm" | "baseWidthMm" | "centerlineOffsetMm" | "visibleAsymmetryMm">): number | null => {
      const values = readings.map((reading) => reading[key]).filter((value): value is number => typeof value === "number");
      if (values.length < 3) return null;
      const current = median(values);
      const old = previous?.[key];
      return typeof old === "number" ? old + alpha * (current - old) : current;
    };
    const profile: ProfileSample[] = latest.profile.map((sample, index) => {
      const values = readings.map((reading) => reading.profile[index]?.radiusMm)
        .filter((value): value is number => typeof value === "number");
      return {
        heightRatio: sample.heightRatio,
        radiusMm: values.length >= 3 ? median(values) : null,
        confidence: values.length / readings.length,
      };
    });
    return {
      ...latest,
      timestampMs: latest.timestampMs,
      heightMm: smooth("heightMm"),
      maximumWidthMm: smooth("maximumWidthMm"),
      rimWidthMm: smooth("rimWidthMm"),
      baseWidthMm: smooth("baseWidthMm"),
      centerlineOffsetMm: smooth("centerlineOffsetMm"),
      visibleAsymmetryMm: smooth("visibleAsymmetryMm"),
      profile,
      confidence: {
        ...latest.confidence,
        freshnessMs: Math.max(0, this.now() - latest.timestampMs),
      },
      windowStartMs: readings[0]!.timestampMs,
      contributingFrameCount: readings.length,
      lastReliableTimestampMs: latest.timestampMs,
    };
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}
