import type { TemporalContourSample } from "./types";

const MAX_DURATION_MS = 120_000;
const MAX_SAMPLES = 2400;

export class TemporalContourBuffer {
  private samples: TemporalContourSample[] = [];

  push(sample: TemporalContourSample): void {
    this.samples.push(cloneSample(sample));
    this.samples.sort((left, right) => left.timestampMs - right.timestampMs);
    const newest = this.samples.at(-1)?.timestampMs ?? sample.timestampMs;
    const cutoff = newest - MAX_DURATION_MS;
    this.samples = this.samples.filter((item) => item.timestampMs >= cutoff);
    if (this.samples.length > MAX_SAMPLES) this.samples.splice(0, this.samples.length - MAX_SAMPLES);
  }

  window(durationMs: number): TemporalContourSample[] {
    const newest = this.samples.at(-1)?.timestampMs;
    if (newest === undefined) return [];
    const cutoff = newest - Math.max(0, durationMs);
    return this.samples.filter((sample) => sample.timestampMs >= cutoff).map(cloneSample);
  }

  clear(_reason: string): void {
    this.samples = [];
  }
}

function cloneSample(sample: TemporalContourSample): TemporalContourSample {
  return { ...sample, centersMm: [...sample.centersMm], leftMm: [...sample.leftMm], rightMm: [...sample.rightMm] };
}
